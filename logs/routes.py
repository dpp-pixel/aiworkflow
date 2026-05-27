# logs/routes.py
from fastapi import APIRouter, HTTPException, Request
from typing import Optional
import json, time
from main.checkpoint_utils import list_checkpoints

router = APIRouter()

_SUMMARY_SYSTEM = (
    "당신은 Java 코드 변경 내역을 읽고 간결하게 요약하는 도우미입니다. "
    "한국어로 2~3문장으로 요약하세요. "
    "형식: '사용자가 [대상]에 [무엇을] 요청했고, AI가 [어떻게] 변경했다.' "
    "요약 텍스트만 출력하고 다른 설명은 하지 마세요."
)


def _ckpt_ts(ckpt: dict) -> float:
    """체크포인트 ISO 시간 → Unix timestamp"""
    try:
        from datetime import datetime, timezone
        return datetime.fromisoformat(ckpt["createdAt"].replace("Z", "+00:00")).timestamp()
    except Exception:
        return 0.0


def _build_tree(checkpoints: list) -> list:
    by_id = {c["id"]: {**c, "children": []} for c in checkpoints}
    roots = []
    for c in checkpoints:
        pid = c.get("parentId")
        if pid and pid in by_id:
            by_id[pid]["children"].append(by_id[c["id"]])
        else:
            roots.append(by_id[c["id"]])

    def sort_node(node):
        node["children"].sort(key=lambda x: x["createdAt"])
        for child in node["children"]:
            sort_node(child)

    roots.sort(key=lambda x: x["createdAt"])
    for r in roots:
        sort_node(r)
    return roots


def _get_file_events(limit: int = 200) -> list:
    """file_changed 로그 조회"""
    try:
        from logs.utils import get_conn
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("""
            SELECT id, type, title, details, ts, summary
            FROM logs
            WHERE type = 'file_changed'
            ORDER BY ts DESC
            LIMIT ?
        """, (limit,))
        rows = cur.fetchall()
        conn.close()
        result = []
        for row in rows:
            details = {}
            try:
                details = json.loads(row[3]) if row[3] else {}
            except Exception:
                pass
            result.append({
                "entryType": "file_event",
                "id": row[0],
                "title": row[2],
                "path": details.get("path", ""),
                "kind": details.get("kind", "modified"),
                "diff": details.get("diff"),
                "ts": row[4],
                "summary": row[5],
            })
        return result
    except Exception as e:
        print(f"[logs] file_events error: {e}")
        return []


@router.get("/ai-sessions")
def get_ai_sessions(limit: int = 100):
    """AI 편집/적용 세션 히스토리 (최신순)"""
    try:
        from logs.utils import get_conn
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("""
            SELECT id, type, title, details, ts, summary
            FROM logs
            WHERE type IN ('ai_edit', 'ai_apply')
            ORDER BY ts DESC
            LIMIT ?
        """, (limit,))
        rows = cur.fetchall()
        conn.close()
        result = []
        for row in rows:
            details = {}
            try:
                details = json.loads(row[3]) if row[3] else {}
            except Exception:
                pass
            result.append({
                "id": row[0],
                "type": row[1],
                "title": row[2],
                "ts": row[4],
                "summary": row[5],
                **details,
            })
        return {"sessions": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ai-sessions/{log_id}/summarize")
def summarize_session(log_id: int, request: Request):
    """AI 편집 로그 항목을 AI로 요약 생성 후 저장"""
    from logs.utils import get_conn
    from main.routes import _call_ai_text
    from app import load_cfg

    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT type, details, summary FROM logs WHERE id=?", (log_id,))
    row = cur.fetchone()
    conn.close()

    if not row:
        raise HTTPException(404, "log not found")

    type_, details_str, existing_summary = row
    if type_ not in ("ai_edit", "ai_apply"):
        raise HTTPException(400, "요약 가능한 로그 타입이 아닙니다")

    details = {}
    try:
        details = json.loads(details_str) if details_str else {}
    except Exception:
        pass

    instruction = details.get("instruction", "")
    anchor      = details.get("anchor", "")
    diff        = (details.get("diff") or "")[:3000]

    user_msg = f"지시문: {instruction}\n대상 앵커: {anchor}\n\n변경 diff:\n{diff}"

    cfg    = load_cfg()
    ai_cfg = cfg.get("ai", {})
    provider = ai_cfg.get("provider", "ollama")

    try:
        summary = _call_ai_text(provider, ai_cfg, _SUMMARY_SYSTEM, user_msg)
    except Exception as e:
        raise HTTPException(500, f"AI 요약 실패: {e}")

    conn = get_conn()
    cur = conn.cursor()
    cur.execute("UPDATE logs SET summary=? WHERE id=?", (summary, log_id))
    conn.commit()
    conn.close()

    return {"summary": summary}


@router.patch("/{log_id}/summary")
def update_summary(log_id: int, body: dict):
    """로그 항목의 summary(AI 분석) 텍스트를 사용자가 직접 수정."""
    from logs.utils import get_conn
    summary = body.get("summary", "")
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT id FROM logs WHERE id=?", (log_id,))
    if not cur.fetchone():
        conn.close()
        raise HTTPException(404, "log not found")
    cur.execute("UPDATE logs SET summary=? WHERE id=?", (summary, log_id))
    conn.commit()
    conn.close()
    return {"ok": True, "summary": summary}


@router.get("/checkpoints")
def get_checkpoints(projectId: Optional[str] = None):
    """체크포인트 목록 (parentId 포함)"""
    try:
        return {"items": list_checkpoints(projectId)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/checkpoints/tree")
def get_checkpoints_tree(projectId: Optional[str] = None, request: Request = None):
    """체크포인트 트리 구조 + 현재 활성 체크포인트"""
    try:
        items = list_checkpoints(projectId)
        current = getattr(request.app.state, "current_checkpoint", None) if request else None
        return {"tree": _build_tree(items), "current": current}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/timeline")
def get_timeline(projectId: Optional[str] = None, request: Request = None):
    """체크포인트 + 파일 변경 이벤트 통합 타임라인 (최신순)"""
    try:
        ckpts = list_checkpoints(projectId)
        ckpt_entries = [
            {**c, "entryType": "checkpoint", "ts": _ckpt_ts(c)}
            for c in ckpts
        ]
        file_events = _get_file_events()
        timeline = sorted(ckpt_entries + file_events, key=lambda x: x.get("ts", 0), reverse=True)
        current = getattr(request.app.state, "current_checkpoint", None) if request else None
        return {"timeline": timeline, "current": current}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
