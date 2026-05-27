# main/routes.py
from fastapi import APIRouter, HTTPException, Query, Request
from pathlib import Path
from typing import Optional, List, Dict, Any, Set
import re
import os
import json
import time
import asyncio
from pydantic import BaseModel
from typing import Literal
from sse_starlette.sse import EventSourceResponse
from .indexers import index_workspace
from .compare_utils import compare_states
from .utils import WORKSPACE, ensure_workspace
from .snippets import build_snippet_pack
from .patch_utils import apply_unified_patch_with_guards, RegionLockViolationError
from .checkpoint_utils import create_checkpoint, list_checkpoints, MANI, _restore_apply
from .diagnostic_utils import (
    run_javac_compile, parse_javac_output, map_diags_to_anchors,
    run_gradle_test_if_available, parse_gradle_test,
    run_compile, parse_compile_output, detect_build_tool,
)
from .diagnostics_utils import compile_project, summarize
from .graph_utils import build_graph
from .relations_utils import build_relations_basic
from .diff_utils import method_line_diff
from .event_bus import BUS
from .watcher import start_watcher

router = APIRouter()

# ---- External AI Job store (in-memory) ----
from typing import Dict, Any
from uuid import uuid4
from threading import RLock
import time, os, requests

AI_JOBS: Dict[str, Dict[str, Any]] = {}
AI_LOCK = RLock()

EXTERNAL_AI_URL = os.getenv("EXTERNAL_AI_URL")         # 예: https://ai.example.com
EXTERNAL_AI_KEY = os.getenv("EXTERNAL_AI_KEY")         # Bearer 키
PUBLIC_BASE_URL  = os.getenv("PUBLIC_BASE_URL", "")    # 예: http://127.0.0.1:8000
AI_CALLBACK_SECRET = os.getenv("AI_CALLBACK_SECRET", "dev-secret")

# 앱 시작 시 워처 가동
_watcher_started = False

def ensure_watcher():
    global _watcher_started
    if not _watcher_started:
        from .watcher import restart_watcher
        restart_watcher()
        _watcher_started = True

# Pydantic models
class CompareReq(BaseModel):
    projectId: str
    from_: Optional[str] = None  # 'ckpt_xxx' | 'working' | 'dir:/path'
    to: str = "working"
    scope: Optional[List[str]] = None  # ["src/**"]

class SnippetReq(BaseModel):
    projectId: str
    anchors: List[str]
    contextLines: int = 3
    baseline: str = "working"
    scope: Optional[List[str]] = None  # 예: ["src/**"]

class ApplyReq(BaseModel):
    projectId: str
    targets: List[str]                # ex) ["m:com.foo.Bar.parse(String)"]
    allowedOps: List[str]             # ["EDIT_METHOD_BODY","ADD_IMPORT"]
    patch: Dict[str, Any]             # {"format":"unified","diff":"...","file":"src/.../Bar.java"}
    rationale: Optional[str] = None

class DiagnoseReq(BaseModel):
    projectId: str
    targets: Optional[List[str]] = None  # 지금은 전체 컴파일. 후속에 선택적 빌드로 확장
    pipeline: List[str] = ["compile"]    # ["compile","test"] 등

class CkptCreateReq(BaseModel):
    projectId: str
    label: str = "manual"
    parentId: Optional[str] = None

class RestoreReq(BaseModel):
    projectId: str
    checkpointId: str
    mode: Literal["dry-run", "apply"] = "dry-run"

class DiffApplyReq(BaseModel):
    projectId: str
    diff: str  # Unified diff content

@router.get("/health")
def health():
    return {"ok": True, "area": "main"}

@router.api_route("/layout/basic", methods=["GET", "POST"])
async def layout_basic(
    request: Request,
    projectId: Optional[str] = Query(None),
    maxMethodLines: Optional[int] = Query(20),
    baseline: Optional[str] = Query(None),
    withRelations: Optional[bool] = Query(True)
):
    """
    기본 자바 코드 레이아웃 반환 (GET/POST 모두 지원)
    """
    try:
        # POST 요청인 경우 body에서 파라미터 추출
        if request.method == "POST":
            try:
                body = await request.json()
                project_id = body.get("projectId") or "default"
                max_method_lines = body.get("maxMethodLines") or 20
                baseline_val = body.get("baseline")
                with_relations = body.get("withRelations", True)
            except:
                # JSON 파싱 실패 시 기본값 사용
                project_id = "default"
                max_method_lines = 20
                baseline_val = None
                with_relations = True
        else:
            # GET 요청인 경우 쿼리 파라미터 사용
            project_id = projectId or "default"
            max_method_lines = maxMethodLines or 20
            baseline_val = baseline
            with_relations = withRelations if withRelations is not None else True

        workspace_path = ensure_workspace()
        if not workspace_path:
            # 워크스페이스가 설정되지 않았으면 빈 결과 반환
            return {"packages": [], "projectId": project_id, "view": "basic"}

        workspace = Path(workspace_path)
        data = index_workspace(workspace)
        request.app.state.last_index = data  # 메서드 본문 조회용 캐시
        
        # maxMethodLines 기준으로 collapsed 플래그 조정
        for pkg in data["packages"]:
            for cls in pkg["classes"]:
                for method in cls["methods"]:
                    method["collapsed"] = bool(method.get("loc", 0) > max_method_lines)
        
        resp = {
            "projectId": project_id,
            "view": "basic",
            "packages": data["packages"],
            "relations": build_relations_basic() if with_relations else []
        }
        
        # baseline이 있으면 오버레이 추가
        if baseline_val:
            try:
                overlay = compare_states(baseline_val, "working")
                resp["overlay"] = overlay
            except Exception as overlay_error:
                # 오버레이 실패해도 기본 레이아웃은 반환
                resp["overlay"] = {"error": str(overlay_error), "changes": []}
        
        return resp
        
    except Exception as e:
        # 화면이 비지 않게, 실패해도 빈 결과를 반환
        return {"packages": [], "error": str(e)}

@router.get("/method")
def get_method(nodeId: str, request: Request):
    if not nodeId.startswith("m:"):
        raise HTTPException(400, "Invalid method nodeId format")

    workspace_path = ensure_workspace()
    if not workspace_path:
        raise HTTPException(400, "Workspace not set")
    workspace = Path(workspace_path)

    # 캐시된 인덱스에서 먼저 탐색, 없으면 즉시 빌드
    index = getattr(request.app.state, 'last_index', None)
    if index is None:
        index = index_workspace(workspace)
        request.app.state.last_index = index

    for pkg in index.get('packages', []):
        for cls in pkg.get('classes', []):
            for method in cls.get('methods', []):
                if method.get('id') != nodeId:
                    continue
                file_rel = cls.get('file', '')
                range_info = method.get('range', {})
                if not file_rel or not range_info:
                    break
                file_abs = workspace / file_rel
                try:
                    lines = file_abs.read_text(encoding="utf-8", errors="ignore").split("\n")
                    sl = range_info["start"][0]
                    el = range_info["end"][0]
                    body = "\n".join(lines[sl : el + 1])
                    return {
                        "id": nodeId,
                        "file": file_rel,
                        "body": body,
                        "range": range_info,
                    }
                except Exception as e:
                    return {"id": nodeId, "file": file_rel, "body": f"// 파일 읽기 실패: {e}", "range": range_info}

    return {
        "id": nodeId,
        "file": "unknown",
        "body": f"// {nodeId} 를 인덱스에서 찾지 못했습니다.\n// 새로고침 버튼을 눌러 인덱스를 다시 빌드하세요.",
        "range": {"start": [0, 0], "end": [0, 0]},
    }

@router.get("/file-content")
def get_file_content(file: str):
    """워크스페이스 기준 상대경로 파일의 전체 내용 반환"""
    workspace_path = ensure_workspace()
    if not workspace_path:
        raise HTTPException(400, "Workspace not set")
    target = (Path(workspace_path) / file).resolve()
    # 워크스페이스 밖 접근 차단
    if not str(target).startswith(str(Path(workspace_path).resolve())):
        raise HTTPException(403, "Access denied")
    if not target.exists():
        raise HTTPException(404, "File not found")
    return {"content": target.read_text(encoding="utf-8", errors="ignore")}


@router.post("/compare")
def compare(req: CompareReq):
    """
    두 상태를 비교하여 변경사항 반환
    """
    try:
        ensure_workspace()
        f = req.from_ or "working"
        overlay = compare_states(f, req.to, req.scope)
        return {"projectId": req.projectId, "overlay": overlay}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/export/snippets")
def export_snippets(req: SnippetReq):
    """
    특정 앵커들에 대한 코드 스니펫 팩 추출
    
    Args:
        req: SnippetReq - projectId, anchors, contextLines, baseline, scope
        
    Returns:
        SnippetPack: {
            "projectId": str,
            "baseline": str,
            "items": [
                {
                    "anchor": str,
                    "file": str, 
                    "range": {"start": [line, col], "end": [line, col]},
                    "hash": str,
                    "text": str
                }
            ],
            "missing": [str]  # 찾지 못한 앵커들
        }
    """
    try:
        ensure_workspace()
        pack = build_snippet_pack(
            project_id=req.projectId,
            anchors=req.anchors,
            context_lines=req.contextLines,
            baseline=req.baseline,
            scope=req.scope
        )
        return pack
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/nodes/{node_id}/apply")
def apply_patch(node_id: str, req: ApplyReq):
    """
    외부 AI가 제안한 unified diff를 안전하게 적용
    
    Args:
        node_id: 노드 ID (향후 확장용)
        req: ApplyReq - 적용 요청 정보
        
    Returns:
        {
            "ok": bool,
            "checkpointId": str,
            "nodeId": str,
            "apply": {...} (성공시),
            "error": str (실패시)
        }
    """
    ensure_workspace()
    
    # 1) 자동 체크포인트 생성 (적용 직전)
    try:
        ckpt_id = create_checkpoint(
            project_id=req.projectId, 
            label=f"auto-before-apply-{node_id}"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create checkpoint: {e}")

    # 2) 가드 검사 + 적용
    try:
        result = apply_unified_patch_with_guards(
            project_id=req.projectId,
            targets=req.targets,
            allowed_ops=req.allowedOps,
            patch=req.patch
        )
        
        # 성공 시 SSE
        BUS.publish_sync({
            "type": "apply_succeeded",
            "paths": result.get("changedFiles", [])
        })

        # AI 적용 로그 기록
        try:
            from logs.utils import log_ai_apply
            changed = [f.get("file", "") if isinstance(f, dict) else str(f)
                       for f in result.get("changedFiles", [])]
            log_ai_apply(anchor=node_id, checkpoint_id=str(ckpt_id), changed_files=changed)
        except Exception:
            pass

        return {
            "ok": True,
            "checkpointId": ckpt_id,
            "nodeId": node_id,
            "apply": result,
            "rationale": req.rationale
        }

    except RegionLockViolationError as e:
        # ❗중요: 200으로 돌려 ok:false + violations 포함 (프론트가 파싱 용이)
        payload = {
            "ok": False, 
            "error": "region_lock_violation", 
            "violations": e.violations,
            "checkpointId": ckpt_id,
            "nodeId": node_id,
            "rationale": req.rationale
        }
        # 실패 SSE도 함께 (메인 자동 새로고침/토스트)
        BUS.publish_sync({
            "type": "apply_failed",
            "reason": "region_lock_violation",
            "violations": e.violations,
        })
        return payload

    except HTTPException:
        raise
    except Exception as e:
        # 다른 에러는 400 (프론트가 j.ok 없을 수 있음)
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/diagnose")
def diagnose(req: DiagnoseReq):
    """
    컴파일/테스트 진단 파이프라인 실행
    
    Args:
        req: DiagnoseReq - 진단 요청 정보
        
    Returns:
        {
            "summary": {"errors": int, "warnings": int},
            "diagnostics": [
                {
                    "kind": "compile" | "test",
                    "severity": "error" | "warning" | "info",
                    "message": str,
                    "file": str,
                    "range": {"start": [line, col], "end": [line, col]},
                    "anchor": str (optional)
                }
            ]
        }
    """
    try:
        ensure_workspace()
        all_diags = []

        if "compile" in req.pipeline:
            tool, code, out, err = run_compile()
            comp_diags_basic = parse_compile_output(tool, out, err)
            comp_diags = map_diags_to_anchors(comp_diags_basic)
            all_diags.extend(comp_diags)
            all_diags.insert(0, {
                "kind": "info", "severity": "info",
                "message": f"빌드 도구: {tool} (returncode={code})"
            })

        if "test" in req.pipeline:
            r = run_gradle_test_if_available()
            if r is not None:
                code, out, err = r
                test_diags = parse_gradle_test(out, err)
                all_diags.extend(test_diags)
            else:
                # gradle 없으면 스킵(정보 제공)
                all_diags.append({
                    "kind":"test","severity":"info",
                    "message":"Gradle wrapper not found; skipped test pipeline"
                })

        errors   = sum(1 for d in all_diags if d.get("severity") == "error")
        warnings = sum(1 for d in all_diags if d.get("severity") == "warning")
        tool     = detect_build_tool()

        return {
            "summary": {"errors": errors, "warnings": warnings, "tool": tool},
            "diagnostics": all_diags
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/diagnose/simple")
def run_diagnose_simple(projectId: str = "default", pipeline: List[str] = ["compile"]):
    """
    간단한 진단 실행 (새로운 diagnostics_utils 사용)
    """
    try:
        ensure_workspace()
        # 지금은 compile만
        res = compile_project()
        diags = res.get("diagnostics", [])
        return {
            "ok": True,
            "tool": res.get("tool"),
            "summary": summarize(diags),
            "diagnostics": diags,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/checkpoints")
def get_checkpoints(projectId: Optional[str] = None):
    """
    체크포인트 목록 조회
    
    Args:
        projectId: 특정 프로젝트의 체크포인트만 필터링 (선택사항)
        
    Returns:
        {"items": [{"id", "projectId", "label", "createdAt", "fileCount"}]}
    """
    try:
        items = list_checkpoints(projectId)
        return {"items": items}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/checkpoints")
def post_checkpoint(req: CkptCreateReq, request: Request):
    """
    새 체크포인트 생성

    Returns:
        {"checkpointId": str}
    """
    try:
        ensure_workspace()
        parent_id = req.parentId or getattr(request.app.state, 'current_checkpoint', None)
        cid = create_checkpoint(project_id=req.projectId, label=req.label, parent_id=parent_id)
        request.app.state.current_checkpoint = cid
        return {"checkpointId": cid}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/diff/method")
def diff_method(projectId: str, baseline: str, anchor: str):
    """
    메서드 단위 라인 diff 조회
    
    Args:
        projectId: 프로젝트 ID
        baseline: 비교 기준점 (체크포인트 ID)
        anchor: 메서드 앵커 (예: m:com.example.Parser.parseTokens)
        
    Returns:
        {
            "projectId": str,
            "anchor": str,
            "kind": "added" | "modified" | "equal",
            "oldLoc": int,
            "newLoc": int,
            "hunks": [
                {
                    "type": "add" | "del" | "mod",
                    "old": [start_line, end_line],
                    "new": [start_line, end_line]
                }
            ]
        }
    """
    try:
        ensure_workspace()
        res = method_line_diff(baseline, anchor)
        return {"projectId": projectId, **res}
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/events")
async def sse_events(request: Request):
    """
    Server-Sent Events 엔드포인트 - 파일 변경 알림
    """
    ensure_watcher()  # 워처 시작
    queue = BUS.subscribe()

    async def event_gen():
        try:
            # 연결 직후 클라이언트 준비용 핑
            yield {
                "event": "ping", 
                "data": json.dumps({"ts": time.time(), "status": "connected"})
            }
            
            while True:
                if await request.is_disconnected():
                    break
                    
                try:
                    # 25초 타임아웃으로 대기
                    data = await asyncio.wait_for(queue.get(), timeout=25.0)
                    yield {"event": "message", "data": data}
                except asyncio.TimeoutError:
                    # keep-alive 핑
                    yield {
                        "event": "ping", 
                        "data": json.dumps({"ts": time.time(), "status": "alive"})
                    }
        except Exception as e:
            print(f"[sse] error in event stream: {e}")
        finally:
            BUS.unsubscribe(queue)

    return EventSourceResponse(event_gen())

@router.post("/checkpoints/restore")
def restore_checkpoint_endpoint(req: RestoreReq):
    """
    체크포인트 원복 (미리보기 또는 적용)
    
    Args:
        req: RestoreReq - 원복 요청
        
    Returns:
        dry-run: {"preview": {"forward": {...}, "backward": {...}}}
        apply: {"ok": bool, "restoredTo": str, "autoBefore": str, "verifyOverlay": {...}}
    """
    try:
        ensure_workspace()
        
        mani_path = MANI / f"{req.checkpointId}.json"
        if not mani_path.exists():
            raise HTTPException(status_code=404, detail="checkpoint not found")
        
        manifest = json.loads(mani_path.read_text(encoding="utf-8"))

        # 미리보기: 현재(working) → 선택한 ckpt 로 갈 때의 변경 요약 제공
        # - forward: working -> ckpt  (실제로 적용될 변화 관점)
        # - backward: ckpt -> working (지금 화면 오버레이와 동일 관점)
        preview_forward = compare_states("working", req.checkpointId)
        preview_backward = compare_states(req.checkpointId, "working")

        if req.mode == "dry-run":
            return {"preview": {"forward": preview_forward, "backward": preview_backward}}

        # apply: 적용 직전 자동 스냅샷
        before_id = create_checkpoint(project_id=req.projectId, label="auto-before-restore",
                                      parent_id=getattr(request.app.state, 'current_checkpoint', None))

        # 실제 복구
        _restore_apply(manifest)

        # 복원 후 현재 체크포인트 갱신
        request.app.state.current_checkpoint = req.checkpointId

        # 복원 후 검증(차이 0 이어야 정상)
        after_overlay = compare_states(req.checkpointId, "working")

        return {
            "ok": True,
            "restoredTo": req.checkpointId,
            "autoBefore": before_id,
            "verifyOverlay": after_overlay
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/layout/graph")
def layout_graph(
    projectId: str,
    level: str = Query("class", pattern="^(class|package)$"),
    baseline: Optional[str] = None,
    kinds: str = "extends,implements,calls,references"
):
    """
    그래프 레이아웃 반환 (클래스/패키지 관계 시각화)
    
    Args:
        projectId: 프로젝트 ID
        level: 그래프 레벨 ("class" | "package")
        baseline: 비교 기준점 (체크포인트 ID)
        kinds: 포함할 관계 종류 (extends,implements,calls,references)
        
    Returns:
        {
            "projectId": str,
            "view": "graph",
            "level": str,
            "nodes": [...],
            "edges": [...]
        }
    """
    try:
        ensure_workspace()
        kindset: Set[str] = {k.strip() for k in kinds.split(",") if k.strip()}
        print(f"[DEBUG ROUTES] kindset = {kindset}", flush=True)
        g = build_graph(level=level, baseline=baseline, kinds=kindset)
        print(f"[DEBUG ROUTES] graph result: {len(g.get('nodes', []))} nodes, {len(g.get('edges', []))} edges", flush=True)

        # Debug info for testing
        pkg_nodes = [n for n in g.get('nodes', []) if n.get('id', '').startswith('pkg:')]

        return {
            "projectId": projectId,
            "view": "graph",
            "level": g["level"],
            "nodes": g["nodes"],
            "edges": g["edges"]
            # baseline을 넘겨줬다면, 노드의 overlay 필드에 반영되어 있음
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/diff/apply")
def apply_diff(req: DiffApplyReq):
    """
    Apply a unified diff to the working directory
    
    Args:
        req: Request containing projectId and diff content
        
    Returns:
        {
            "ok": bool,
            "appliedFiles": [str],
            "message": str
        }
    """
    try:
        ensure_workspace()
        
        # Apply the unified diff using existing patch utils
        from pathlib import Path
        import tempfile
        
        # Write diff to temp file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.patch', delete=False) as f:
            f.write(req.diff)
            patch_file = f.name
        
        try:
            # Apply the patch
            result = apply_unified_patch_with_guards(patch_file, Path(WORKSPACE))
            
            # Clean up temp file
            os.unlink(patch_file)
            
            if result.get("ok"):
                BUS.publish_sync({
                    "type": "index_updated",
                    "paths": result.get("appliedFiles", []),
                    "reason": "diff_applied"
                })
                
                return {
                    "ok": True,
                    "appliedFiles": result.get("appliedFiles", []),
                    "message": "Diff applied successfully"
                }
            else:
                raise HTTPException(status_code=400, detail=result.get("error", "Failed to apply diff"))
                
        except Exception as e:
            # Clean up temp file on error
            if os.path.exists(patch_file):
                os.unlink(patch_file)
            raise
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
# ---- AI Job endpoints ----
from fastapi import Body

@router.post("/ai/jobs")
def create_ai_job(body: dict = Body(...)):
    """
    body: { projectId, anchors[], baseline?, contextLines?, profile? }
    외부 AI 서버에 작업을 제출하고 jobId 반환
    """
    project_id = body.get("projectId", "PRJ")
    anchors = body.get("anchors") or []
    baseline = body.get("baseline", "working")
    ctx = int(body.get("contextLines", 3))
    if not anchors:
        raise HTTPException(400, "anchors required")

    # 스니펫팩 (이미 있는 util 재사용)
    pack = build_snippet_pack(project_id, anchors, ctx, baseline)

    job_id = uuid4().hex
    with AI_LOCK:
        AI_JOBS[job_id] = {
            "id": job_id, "status": "queued", "anchors": anchors,
            "projectId": project_id, "baseline": baseline,
            "createdAt": int(time.time())
        }

    # 외부 AI 서버로 제출 (없으면 스킵)
    if not EXTERNAL_AI_URL:
        # 외부 서버가 없다면 데모용으로 곧바로 failed 로 표기
        with AI_LOCK:
            AI_JOBS[job_id]["status"] = "failed"
            AI_JOBS[job_id]["error"] = "EXTERNAL_AI_URL not configured"
        return {"jobId": job_id, "status": "failed", "error": "external AI not configured"}

    # payload 준비
    callback_url = f"{PUBLIC_BASE_URL.rstrip('/')}/main/ai/callback"
    payload = {
        "jobId": job_id,
        "anchors": anchors,
        "baseline": baseline,
        "rules": ["EDIT_METHOD_BODY","ADD_IMPORT"],
        "callbackUrl": callback_url,
        "callbackSecret": AI_CALLBACK_SECRET,
    }
    # bundle(zip) 파일 파트
    import io, zipfile, json
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("prompt.json", json.dumps(payload, ensure_ascii=False, indent=2))
        for i, it in enumerate(pack["items"], 1):
            safe = it["anchor"].replace(":","_").replace(" ","_").replace("/","_")
            z.writestr(f"snippets/{i:02d}_{safe}.java", it["text"])
    buf.seek(0)

    headers = {"Authorization": f"Bearer {EXTERNAL_AI_KEY}"} if EXTERNAL_AI_KEY else {}
    files = {"bundle": ("bundle.zip", buf.getvalue(), "application/zip")}
    try:
        requests.post(f"{EXTERNAL_AI_URL.rstrip('/')}/jobs",
                      headers=headers, files=files, data={"jobId": job_id}, timeout=30)
        with AI_LOCK:
            AI_JOBS[job_id]["status"] = "running"
    except Exception as e:
        with AI_LOCK:
            AI_JOBS[job_id]["status"] = "failed"
            AI_JOBS[job_id]["error"]  = f"submit error: {e}"

    return {"jobId": job_id, "status": AI_JOBS[job_id]["status"]}


@router.get("/ai/jobs/{job_id}")
def get_ai_job(job_id: str):
    """작업 상태 조회"""
    with AI_LOCK:
        job = AI_JOBS.get(job_id)
        if not job:
            raise HTTPException(404, "job not found")
        # diff는 길 수 있으니 필요 시 앞부분만
        return job


@router.post("/ai/callback")
async def ai_callback(request: Request):
    """외부 AI 서버 콜백 엔드포인트"""
    # 외부 AI 서버가 호출: {jobId, status, diff?, error?}
    body = await request.json()
    secret = request.headers.get("X-AI-CALLBACK-TOKEN")
    if secret != AI_CALLBACK_SECRET:
        raise HTTPException(401, "invalid callback token")

    job_id = body.get("jobId")
    if not job_id:
        raise HTTPException(400, "jobId required")

    with AI_LOCK:
        job = AI_JOBS.get(job_id)
        if not job:
            raise HTTPException(404, "job not found")
        job["status"] = body.get("status", "done")
        if body.get("diff"):   job["diff"] = body["diff"]
        if body.get("error"):  job["error"] = body["error"]
        job["updatedAt"] = int(time.time())

    return {"ok": True}


# ---- 통합 AI 완성 엔드포인트 ----

_SIG_IDENTIFY_SYSTEM = (
    "You are a Java codebase analyzer. "
    "Given method signatures with anchor IDs, identify which methods need modification. "
    "Return ONLY valid JSON: {\"targets\": [\"anchor_id_1\", \"anchor_id_2\"]}. "
    "No explanation, no markdown, just JSON."
)

_DIFF_SYSTEM_PROMPT = (
    "You are a Java code editor. "
    "When given Java source code and an instruction, apply the change and return ONLY a unified diff. "
    "Format: --- a/path/to/File.java / +++ b/path/to/File.java / @@ hunks. "
    "Include 3 lines of context around changes. "
    "Do not reformat or change unrelated code. "
    "Output the diff only, no explanation."
)

_PARSE_SYSTEM = (
    "You are a file operation extractor. "
    "Given text that contains code editing instructions (possibly in Korean or English), "
    "extract all file operations and return ONLY a JSON array. "
    "Each element: {\"action\": \"modify\"|\"create\"|\"delete\", \"file\": \"relative/path/to/File.java\", "
    "\"diff\": \"unified diff string (for modify)\", \"content\": \"full file content (for create)\"} "
    "For modify: include unified diff with --- a/path +++ b/path headers. "
    "For create: include full file content. "
    "  IMPORTANT for Java files: always infer the package declaration from the file path. "
    "  Example: file='src/main/java/model/Alpha.java' → first line must be 'package model;' "
    "  Example: file='src/main/java/com/example/service/UserService.java' → 'package com.example.service;' "
    "  The package is everything between 'java/' and the filename, with '/' replaced by '.'. "
    "For delete: only file path needed. "
    "Return ONLY the JSON array, no explanation, no markdown."
)

_ANALYZE_SYSTEM = (
    "당신은 Java 코드 변경을 분석하는 도우미입니다. "
    "파일 변경 내역을 보고 한국어로 정확히 2문장으로 답하세요. "
    "첫 번째 문장: 무슨 작업인지 (파일명, 변경 종류 포함). "
    "두 번째 문장: 왜 한 것 같은지 (추측). "
    "형식: '작업: [내용]\n의도: [추측]' — 이 두 줄만 출력하세요."
)

def _extract_diff(text: str) -> str:
    """AI 응답에서 unified diff 블록 추출."""
    import re
    # ```diff 또는 ``` 블록 안에 있으면 추출
    m = re.search(r"```(?:diff)?\n(.*?)```", text, re.DOTALL)
    if m:
        return m.group(1).strip()
    # --- a/ 로 시작하는 라인부터 끝까지 추출
    m = re.search(r"(---\s+a/.+)", text, re.DOTALL)
    if m:
        return m.group(1).strip()
    return text.strip()


def _call_ai_text(provider: str, ai_cfg: dict, system: str, user: str) -> str:
    """AI 제공자에 텍스트 요청 후 raw 텍스트 반환 (diff/JSON 공용)."""
    if provider == "openai":
        api_key = ai_cfg.get("openai_key", "")
        model   = ai_cfg.get("openai_model", "gpt-4o")
        resp = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"model": model, "messages": [
                {"role": "system", "content": system},
                {"role": "user",   "content": user},
            ]},
            timeout=60,
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]
    else:  # ollama (default)
        ollama_url = ai_cfg.get("ollama_url", "http://localhost:11434").rstrip("/")
        model      = ai_cfg.get("ollama_model", "qwen2.5-coder:7b")
        resp = requests.post(
            f"{ollama_url}/api/chat",
            json={"model": model, "stream": False, "messages": [
                {"role": "system", "content": system},
                {"role": "user",   "content": user},
            ]},
            timeout=120,
        )
        resp.raise_for_status()
        return resp.json()["message"]["content"]


def _auto_analyze_log(log_id: int) -> None:
    """파일 변경 로그에 AI 자동 분석 추가 (watcher 스레드에서 호출)."""
    try:
        from app import load_cfg
        from logs.utils import get_conn
        cfg = load_cfg()
        ai_cfg = cfg.get("ai", {})
        provider = ai_cfg.get("provider", "ollama")

        conn = get_conn()
        cur = conn.cursor()
        cur.execute("SELECT details FROM logs WHERE id=?", (log_id,))
        row = cur.fetchone()
        conn.close()
        if not row:
            return

        import json as _json
        details = {}
        try:
            details = _json.loads(row[0]) if row[0] else {}
        except Exception:
            pass

        path = details.get("path", "")
        kind = details.get("kind", "")
        diff = (details.get("diff") or "")[:2000]

        user_msg = f"파일: {path}\n변경 종류: {kind}\n\ndiff:\n{diff}" if diff else f"파일: {path}\n변경 종류: {kind}"

        summary = _call_ai_text(provider, ai_cfg, _ANALYZE_SYSTEM, user_msg)

        conn = get_conn()
        cur = conn.cursor()
        cur.execute("UPDATE logs SET summary=? WHERE id=?", (summary.strip(), log_id))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[auto-analyze] log_id={log_id} error: {e}")


@router.post("/ai/sig-request")
def ai_sig_request(body: dict = Body(...), request: Request = None):
    """
    Sig 뷰 기반 자유 지시문 AI 요청 (2-step).
    Step1: 전체 sig → AI가 타겟 앵커 선정 (JSON)
    Step2: 각 앵커 실제 코드 → AI가 unified diff 생성
    Input:  { projectId, instruction }
    Output: { targets, diff, provider, model }
    """
    import json as _json
    import sys as _sys
    _sys.path.insert(0, str(Path(__file__).parent.parent))
    from app import load_cfg

    cfg    = load_cfg()
    ai_cfg = cfg.get("ai", {})
    provider = ai_cfg.get("provider", "ollama")

    instruction = (body.get("instruction") or "").strip()
    project_id  = body.get("projectId", "default")
    if not instruction:
        raise HTTPException(400, "instruction required")

    index = getattr(request.app.state, "last_index", None) if request else None
    if not index:
        raise HTTPException(400, "인덱스 없음 — 워크스페이스 스캔 먼저 해주세요.")

    # ── Step 1: sig context 빌드 ─────────────────────────────
    sig_lines: list[str] = []
    anchor_to_info: dict = {}
    for pkg in index.get("packages", []):
        for cls in pkg.get("classes", []):
            file_path = cls.get("file", "")
            methods   = cls.get("methods", [])
            if not methods:
                continue
            sig_lines.append(f"\n## {file_path}\nclass {cls['name']}:")
            for m in methods:
                anchor   = m["id"]
                sig      = m.get("sig") or m.get("uiLabel", "")
                sl       = m.get("range", {}).get("start", [0])[0]
                el       = m.get("range", {}).get("end", [0])[0]
                sig_lines.append(f"  [{anchor}] {sig}  // lines {sl}-{el}")
                anchor_to_info[anchor] = {
                    "file": file_path,
                    "sig": sig,
                    "range": m.get("range", {}),
                }

    sig_context = "\n".join(sig_lines)
    step1_user  = f"# Method Signatures\n{sig_context}\n\n# Instruction\n{instruction}"

    try:
        raw1 = _call_ai_text(provider, ai_cfg, _SIG_IDENTIFY_SYSTEM, step1_user)
    except Exception as e:
        raise HTTPException(502, f"AI Step1 오류: {e}")

    # JSON 파싱 (코드블록 안에 있을 수도 있음)
    import re as _re
    json_m = _re.search(r"\{.*\}", raw1, _re.DOTALL)
    targets: list[str] = []
    if json_m:
        try:
            targets = _json.loads(json_m.group()).get("targets", [])
        except Exception:
            pass
    # 파싱 실패 시 anchor가 응답 텍스트 안에 있으면 fallback
    if not targets:
        targets = [a for a in anchor_to_info if a in raw1]

    # 인덱스에 없는 앵커 제거
    targets = [t for t in targets if t in anchor_to_info]
    if not targets:
        raise HTTPException(400, f"AI가 수정 대상을 찾지 못했습니다. 지시문을 더 구체적으로 작성해주세요.\n(AI 응답: {raw1[:300]})")

    # ── Step 2: 각 앵커 실제 코드 → diff 생성 ───────────────
    custom_sys   = ai_cfg.get("system_prompt", "").strip()
    system_prompt = custom_sys if custom_sys else _DIFF_SYSTEM_PROMPT

    diffs: list[str] = []
    model_used = ""
    for anchor in targets:
        try:
            pack = build_snippet_pack(project_id, [anchor], 3, "working")
            code = pack["items"][0]["text"] if pack.get("items") else ""
            real_file = anchor_to_info.get(anchor, {}).get("file", "")
            user_msg = (
                f"Anchor: {anchor}\n"
                f"File: {real_file}\n"
                f"Instruction: {instruction}\n\n"
                f"IMPORTANT: Use exactly '--- a/{real_file}' and '+++ b/{real_file}' in the diff header.\n\n"
                f"```java\n{code}\n```"
            )
            raw2 = _call_ai_text(provider, ai_cfg, system_prompt, user_msg)
            d    = _extract_diff(raw2)
            if d:
                diffs.append(d)
            # model 이름 추출 (Ollama 응답엔 없으니 cfg에서)
            model_used = ai_cfg.get("ollama_model" if provider == "ollama" else "openai_model", "")
        except Exception as e:
            print(f"[sig-request] Step2 오류 ({anchor}): {e}")

    # AI 편집 로그
    try:
        from logs.utils import log_ai_edit
        log_ai_edit(anchor=",".join(targets), instruction=instruction,
                    provider=provider, model=model_used, diff="\n".join(diffs))
    except Exception:
        pass

    return {
        "type": "sync",
        "targets": targets,
        "diff": "\n".join(diffs),
        "provider": provider,
        "model": model_used,
    }


@router.post("/ai/sig-apply")
def ai_sig_apply(body: dict = Body(...)):
    """
    Sig AI 요청 결과 diff 적용 (멀티파일 지원, 체크포인트 자동 생성).
    Input:  { projectId, diff }
    Output: { ok, checkpointId, changedFiles }
    """
    project_id = body.get("projectId", "default")
    diff_text  = body.get("diff", "").strip()
    if not diff_text:
        raise HTTPException(400, "diff required")

    ensure_workspace()
    workspace = Path(WORKSPACE)

    # 자동 체크포인트
    ckpt_id = create_checkpoint(project_id, "auto-before-sig-ai")

    # 멀티파일 diff 적용
    from .patch_utils import parse_unified_diff, apply_patch_to_text
    try:
        patches = parse_unified_diff(diff_text)
    except Exception as e:
        raise HTTPException(400, f"diff 파싱 실패: {e}")

    changed: list[str] = []
    errors:  list[str] = []
    for fp in patches:
        fpath = workspace / fp.path
        if not fpath.exists():
            # strip leading a/ or b/ just in case
            alt = fp.path.lstrip("ab/")
            fpath = workspace / alt
        if not fpath.exists():
            errors.append(f"파일 없음: {fp.path}")
            continue
        try:
            lines = fpath.read_text(encoding="utf-8", errors="replace").splitlines()
            for hunk in fp.hunks:
                lines, _ = apply_patch_to_text(lines, hunk)
            fpath.write_text("\n".join(lines), encoding="utf-8")
            changed.append(fp.path)
        except Exception as e:
            errors.append(f"{fp.path}: {e}")

    if errors and not changed:
        raise HTTPException(400, f"적용 실패: {'; '.join(errors)}")

    BUS.publish_sync({
        "type": "index_updated",
        "paths": changed,
        "reason": "sig_ai_applied"
    })

    return {"ok": True, "checkpointId": ckpt_id, "changedFiles": changed, "errors": errors}


@router.post("/ai/complete")
def ai_complete(body: dict = Body(...)):
    """
    설정된 AI 제공자로 코드 완성(diff 생성) 요청.
    Input:  { projectId, anchors[], baseline?, contextLines?, instruction? }
    Output:
      Sync  → { type:"sync",  diff:"...", provider, model }
      Async → { type:"async", jobId:"...", status:"running" }
    """
    import sys, os as _os
    sys.path.insert(0, str(Path(__file__).parent.parent))
    from app import load_cfg

    cfg = load_cfg()
    ai_cfg = cfg.get("ai", {})
    provider = ai_cfg.get("provider", "ollama")

    project_id = body.get("projectId", "default")
    anchors = body.get("anchors") or []
    baseline = body.get("baseline", "working")
    ctx = int(body.get("contextLines", 3))
    instruction = body.get("instruction", "Improve this method.")

    # 커스텀 시스템 프롬프트 (설정에 없으면 기본값)
    custom_sys = ai_cfg.get("system_prompt", "").strip()
    system_prompt = custom_sys if custom_sys else _DIFF_SYSTEM_PROMPT

    if not anchors:
        raise HTTPException(400, "anchors required")

    pack = build_snippet_pack(project_id, anchors, ctx, baseline)
    code = pack["items"][0]["text"] if pack.get("items") else ""
    anchor = anchors[0]

    user_msg = f"Anchor: {anchor}\nInstruction: {instruction}\n\n```java\n{code}\n```"

    # ── OpenAI ──────────────────────────────────────────────
    if provider == "openai":
        api_key = ai_cfg.get("openai_key", "")
        model = ai_cfg.get("openai_model", "gpt-4o")
        if not api_key:
            raise HTTPException(400, "OpenAI API key not configured")
        try:
            resp = requests.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={"model": model, "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_msg}
                ]},
                timeout=60
            )
            resp.raise_for_status()
            raw = resp.json()["choices"][0]["message"]["content"]
            diff_out = _extract_diff(raw)
            try:
                from logs.utils import log_ai_edit
                log_ai_edit(anchor=anchor, instruction=instruction, provider="openai", model=model, diff=diff_out)
            except Exception: pass
            return {"type": "sync", "diff": diff_out, "provider": "openai", "model": model}
        except requests.RequestException as e:
            raise HTTPException(502, f"OpenAI API error: {e}")

    # ── Ollama (HTTP API) ────────────────────────────────────
    elif provider == "ollama":
        ollama_url = ai_cfg.get("ollama_url", "http://localhost:11434").rstrip("/")
        model = ai_cfg.get("ollama_model", "qwen2.5-coder:7b")
        try:
            resp = requests.post(
                f"{ollama_url}/api/chat",
                json={"model": model, "stream": False, "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_msg}
                ]},
                timeout=120
            )
            resp.raise_for_status()
            raw = resp.json()["message"]["content"]
            diff_out = _extract_diff(raw)
            try:
                from logs.utils import log_ai_edit
                log_ai_edit(anchor=anchor, instruction=instruction, provider="ollama", model=model, diff=diff_out)
            except Exception: pass
            return {"type": "sync", "diff": diff_out, "provider": "ollama", "model": model}
        except requests.RequestException as e:
            raise HTTPException(502, f"Ollama error: {e}")

    # ── External (기존 콜백 시스템) ──────────────────────────
    elif provider == "external":
        ext_url = ai_cfg.get("external_url", "") or _os.getenv("EXTERNAL_AI_URL", "")
        ext_key = ai_cfg.get("external_key", "") or _os.getenv("EXTERNAL_AI_KEY", "")
        if not ext_url:
            raise HTTPException(400, "External AI URL not configured")

        job_id = uuid4().hex
        with AI_LOCK:
            AI_JOBS[job_id] = {"id": job_id, "status": "queued", "anchors": anchors,
                               "projectId": project_id, "createdAt": int(time.time())}

        pub_base = ai_cfg.get("public_base_url", "") or _os.getenv("PUBLIC_BASE_URL", "")
        callback_url = f"{pub_base.rstrip('/')}/main/ai/callback"
        payload = {"jobId": job_id, "anchors": anchors, "baseline": baseline,
                   "rules": ["EDIT_METHOD_BODY", "ADD_IMPORT"],
                   "callbackUrl": callback_url,
                   "callbackSecret": _os.getenv("AI_CALLBACK_SECRET", "dev-secret")}
        import io, zipfile, json as _json
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr("prompt.json", _json.dumps(payload, ensure_ascii=False, indent=2))
            for i, it in enumerate(pack.get("items", []), 1):
                safe = it["anchor"].replace(":", "_").replace(" ", "_").replace("/", "_")
                z.writestr(f"snippets/{i:02d}_{safe}.java", it["text"])
        buf.seek(0)
        headers = {"Authorization": f"Bearer {ext_key}"} if ext_key else {}
        try:
            requests.post(f"{ext_url.rstrip('/')}/jobs",
                          headers=headers, files={"bundle": ("bundle.zip", buf.getvalue(), "application/zip")},
                          data={"jobId": job_id}, timeout=30)
            with AI_LOCK:
                AI_JOBS[job_id]["status"] = "running"
        except Exception as e:
            with AI_LOCK:
                AI_JOBS[job_id]["status"] = "failed"
                AI_JOBS[job_id]["error"] = str(e)
        return {"type": "async", "jobId": job_id, "status": AI_JOBS[job_id]["status"]}

    else:
        raise HTTPException(400, f"Unknown provider: {provider}")


@router.get("/ai/test")
def ai_test():
    """현재 설정된 AI 제공자 연결 테스트."""
    import sys, time as _time
    sys.path.insert(0, str(Path(__file__).parent.parent))
    from app import load_cfg

    cfg = load_cfg()
    ai_cfg = cfg.get("ai", {})
    provider = ai_cfg.get("provider", "ollama")
    t0 = _time.time()

    try:
        if provider == "ollama":
            url = ai_cfg.get("ollama_url", "http://localhost:11434").rstrip("/")
            r = requests.get(f"{url}/api/tags", timeout=5)
            r.raise_for_status()
            models = [m["name"] for m in r.json().get("models", [])]
            return {"ok": True, "provider": "ollama", "latency_ms": int((_time.time()-t0)*1000), "models": models}

        elif provider == "openai":
            key = ai_cfg.get("openai_key", "")
            if not key:
                return {"ok": False, "provider": "openai", "error": "API key not set"}
            r = requests.get("https://api.openai.com/v1/models",
                             headers={"Authorization": f"Bearer {key}"}, timeout=10)
            r.raise_for_status()
            return {"ok": True, "provider": "openai", "latency_ms": int((_time.time()-t0)*1000)}

        elif provider == "external":
            url = ai_cfg.get("external_url", "").rstrip("/")
            if not url:
                return {"ok": False, "provider": "external", "error": "External URL not set"}
            r = requests.get(f"{url}/health", timeout=5)
            r.raise_for_status()
            return {"ok": True, "provider": "external", "latency_ms": int((_time.time()-t0)*1000)}

    except Exception as e:
        return {"ok": False, "provider": provider, "error": str(e)}

    return {"ok": False, "provider": provider, "error": "Unknown provider"}


# ---- 내부 AI 분석 (Ollama) ----
from .analyze_runner import run_ollama_analyze, analyze_class
import sys
sys.path.append(str(Path(__file__).parent.parent))
from logs.utils import log_ai_analysis

class AnalyzeReq(BaseModel):
    code: str
    method_name: Optional[str] = None
    model: str = "qwen2.5-coder:7b"

@router.post("/ai/analyze")
async def analyze_method(req: AnalyzeReq):
    """
    내부 AI를 사용한 메서드 분석

    Args:
        req: {
            "code": "Java 코드",
            "method_name": "메서드명 (선택)",
            "model": "모델명 (기본: qwen2.5-coder:7b)"
        }

    Returns:
        {
            "ok": bool,
            "data": {
                "method_name": str,
                "purpose": str,
                "complexity": int,
                "externals": [str]
            },
            "duration": float,
            "log_id": int
        }
    """
    try:
        # Ollama로 분석 실행
        result = run_ollama_analyze(req.code, model=req.model)

        # 로그에 저장
        method_name = req.method_name or result.get("data", {}).get("method_name", "unknown")
        log_id = log_ai_analysis(
            method_name=method_name,
            result=result,
            code_snippet=req.code
        )

        # 결과 반환
        if result["ok"]:
            return {
                "ok": True,
                "data": result["data"],
                "duration": result["duration"],
                "model": result.get("model"),
                "log_id": log_id
            }
        else:
            return {
                "ok": False,
                "error": result.get("error"),
                "duration": result.get("duration"),
                "log_id": log_id
            }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _do_apply_ops(workspace: str, ops: list) -> tuple:
    """ops 목록을 워크스페이스에 적용. returns (applied_list, all_diffs_list)."""
    import os as _os
    from pathlib import Path as _Path
    from .patch_utils import parse_unified_diff, apply_patch_to_text

    applied = []
    all_diffs = []

    for op in ops:
        action = (op.get("action") or "").lower()
        rel_file = (op.get("file") or "").replace("\\", "/").lstrip("/")

        if not rel_file and action != "delete":
            applied.append({"action": action, "file": rel_file, "status": "skipped", "error": "no file path"})
            continue

        abs_path = _os.path.join(workspace, rel_file) if rel_file else ""

        try:
            if action == "create":
                content = op.get("content", "")
                _Path(abs_path).parent.mkdir(parents=True, exist_ok=True)
                _Path(abs_path).write_text(content, encoding="utf-8")
                applied.append({"action": "create", "file": rel_file, "status": "ok"})

            elif action == "delete":
                if abs_path and _os.path.isfile(abs_path):
                    _os.remove(abs_path)
                    applied.append({"action": "delete", "file": rel_file, "status": "ok"})
                else:
                    applied.append({"action": "delete", "file": rel_file, "status": "skipped", "error": "file not found"})

            elif action == "modify":
                diff_text = op.get("diff", "")
                if not diff_text:
                    applied.append({"action": "modify", "file": rel_file, "status": "skipped", "error": "no diff"})
                    continue
                patches = parse_unified_diff(diff_text)
                if not patches:
                    applied.append({"action": "modify", "file": rel_file, "status": "skipped", "error": "invalid diff"})
                    continue
                target = abs_path if _os.path.isfile(abs_path) else None
                if not target:
                    for fp in patches:
                        candidate = _os.path.join(workspace, fp.path.lstrip("/"))
                        if _os.path.isfile(candidate):
                            target = candidate
                            rel_file = fp.path.lstrip("/")
                            break
                if not target:
                    applied.append({"action": "modify", "file": rel_file, "status": "error", "error": "file not found"})
                    continue
                lines = _Path(target).read_text(encoding="utf-8", errors="ignore").splitlines(keepends=True)
                for fp in patches:
                    for hunk in fp.hunks:
                        lines = apply_patch_to_text(lines, hunk)
                _Path(target).write_text("".join(lines), encoding="utf-8")
                all_diffs.append(diff_text)
                applied.append({"action": "modify", "file": rel_file, "status": "ok"})

            else:
                applied.append({"action": action, "file": rel_file, "status": "skipped", "error": "unknown action"})

        except Exception as ex:
            applied.append({"action": action, "file": rel_file, "status": "error", "error": str(ex)})

    return applied, all_diffs


@router.post("/ai/paste-apply")
def ai_paste_apply(body: dict = Body(...)):
    """
    ChatGPT 등 외부 AI 응답 텍스트를 붙여넣으면 AI가 파싱해서 파일 조작 실행.
    Input:  { text: "ChatGPT 응답 전체", projectId: "default" }
    Output: { ok: true, applied: [{action, file, status, error?}] }
    """
    import json as _json, os as _os, re as _re
    from pathlib import Path as _Path
    from app import load_cfg

    text = (body.get("text") or "").strip()
    if not text:
        raise HTTPException(400, "text is required")

    cfg = load_cfg()
    ai_cfg = cfg.get("ai", {})
    provider = ai_cfg.get("provider", "ollama")

    workspace = ensure_workspace()
    if not workspace:
        raise HTTPException(400, "workspace not set")

    # 현재 인덱스에서 프로젝트 구조 컨텍스트 생성
    project_context = ""
    try:
        from app import app as _app
        idx = getattr(_app.state, "last_index", None)
        if idx and idx.get("packages"):
            pkg_lines = []
            for pkg in idx["packages"]:
                pkg_name = pkg.get("packageName", "")
                classes = [c.get("className", "") for c in pkg.get("classes", [])]
                if pkg_name and classes:
                    pkg_lines.append(f"  package {pkg_name}: {', '.join(classes)}")
            if pkg_lines:
                project_context = "\n\nCurrent project packages:\n" + "\n".join(pkg_lines)
    except Exception:
        pass

    # 1) AI로 파일 조작 지시 파싱
    try:
        raw = _call_ai_text(provider, ai_cfg, _PARSE_SYSTEM, text + project_context)
    except Exception as e:
        raise HTTPException(502, f"AI 파싱 오류: {e}")

    # JSON 추출 (코드블록 제거)
    raw_clean = _re.sub(r"```(?:json)?\n?", "", raw).replace("```", "").strip()
    try:
        ops = _json.loads(raw_clean)
        if not isinstance(ops, list):
            raise ValueError("not a list")
    except Exception:
        # 폴백: diff만 추출해서 단일 modify 시도
        diff = _extract_diff(raw)
        if not diff:
            raise HTTPException(422, f"AI 응답을 파싱할 수 없습니다: {raw[:200]}")
        ops = [{"action": "modify", "file": "unknown", "diff": diff}]

    # dry_run: ops 확인만 하고 적용 안 함
    if body.get("dry_run", False):
        return {"ok": True, "ops": ops}

    # 2) 각 지시 실행
    from logs.utils import log_ai_edit
    applied, all_diffs = _do_apply_ops(workspace, ops)

    # 3) 로그 기록
    try:
        ok_files = [a["file"] for a in applied if a["status"] == "ok"]
        log_ai_edit(
            anchor=", ".join(ok_files) or "paste-apply",
            instruction=text[:300],
            provider=provider,
            model=ai_cfg.get(f"{provider}_model", ""),
            diff="\n".join(all_diffs),
        )
    except Exception:
        pass

    # 4) SSE 발행
    try:
        changed_paths = [a["file"] for a in applied if a["status"] == "ok"]
        BUS.publish_sync({"type": "index_updated", "paths": changed_paths, "touchedAnchors": []})
    except Exception:
        pass

    return {"ok": True, "applied": applied}


@router.post("/ai/paste-apply-ops")
def ai_paste_apply_ops(body: dict = Body(...)):
    """Pre-parsed ops를 직접 적용 (AI 호출 없이)."""
    from app import load_cfg
    from logs.utils import log_ai_edit

    ops = body.get("ops", [])
    if not ops:
        raise HTTPException(400, "ops required")

    workspace = ensure_workspace()
    if not workspace:
        raise HTTPException(400, "workspace not set")

    cfg = load_cfg()
    ai_cfg = cfg.get("ai", {})
    provider = ai_cfg.get("provider", "ollama")

    applied, all_diffs = _do_apply_ops(workspace, ops)

    try:
        ok_files = [a["file"] for a in applied if a["status"] == "ok"]
        log_ai_edit(
            anchor=", ".join(ok_files) or "paste-apply-ops",
            instruction="(붙여넣기 적용)",
            provider=provider,
            model=ai_cfg.get(f"{provider}_model", ""),
            diff="\n".join(all_diffs),
        )
    except Exception:
        pass

    try:
        changed_paths = [a["file"] for a in applied if a["status"] == "ok"]
        BUS.publish_sync({"type": "index_updated", "paths": changed_paths, "touchedAnchors": []})
    except Exception:
        pass

    return {"ok": True, "applied": applied}


@router.post("/ai/analyze-class")
async def analyze_class_endpoint(req: AnalyzeReq):
    """
    클래스 전체 분석
    """
    try:
        result = analyze_class(req.code, model=req.model)

        if result["ok"]:
            return {
                "ok": True,
                "data": result["data"],
                "duration": result["duration"],
                "model": result.get("model")
            }
        else:
            return {
                "ok": False,
                "error": result.get("error"),
                "duration": result.get("duration")
            }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))