# main/checkpoint_utils.py
from __future__ import annotations
from pathlib import Path
import hashlib, json, time, shutil
from typing import Dict, Any, List

from .utils import WORKSPACE

CKPT_ROOT = Path("./.contextpanel/checkpoints").resolve()
BLOBS = CKPT_ROOT / "blobs"
MANI  = CKPT_ROOT / "manifests"
for d in (CKPT_ROOT, BLOBS, MANI): d.mkdir(parents=True, exist_ok=True)

def _sha_bytes(b: bytes) -> str:
    """바이트 데이터의 SHA1 해시 생성"""
    return hashlib.sha1(b).hexdigest()

def create_checkpoint(project_id: str, label: str = "manual") -> str:
    """
    현재 워크스페이스의 모든 파일을 체크포인트로 저장
    
    Args:
        project_id: 프로젝트 ID
        label: 체크포인트 라벨
        
    Returns:
        생성된 체크포인트 ID
    """
    ts = time.strftime("%Y%m%d_%H%M%S")
    ts_hash = hashlib.sha1(ts.encode()).hexdigest()[:4]
    cid = f"ckpt_{ts}_{ts_hash}"
    
    files = []
    workspace_path = Path(WORKSPACE)
    
    # 워크스페이스의 모든 파일 수집 (.contextpanel 제외)
    for p in workspace_path.rglob("*"):
        # .contextpanel 은 제외
        if ".contextpanel" in p.parts: 
            continue
        if p.is_file():
            try:
                b = p.read_bytes()
                sha = _sha_bytes(b)
                
                # 블롭 저장 (해시의 처음 2자리로 디렉터리 분산)
                blob_dir = BLOBS / sha[:2]
                blob_dir.mkdir(exist_ok=True)
                blob_path = blob_dir / sha
                
                # 이미 존재하지 않으면 저장 (중복 방지)
                if not blob_path.exists():
                    blob_path.write_bytes(b)
                
                # 파일 정보 수집
                files.append({"path": str(p.relative_to(WORKSPACE)).replace("\\","/"),
                              "sha": sha, "size": p.stat().st_size})
                
            except Exception as e:
                # 읽을 수 없는 파일은 건너뛰기
                print(f"Warning: Could not read file {p}: {e}")
                continue
    
    manifest = {
        "id": cid, "projectId": project_id, "label": label,
        "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "files": files
    }
    (MANI/f"{cid}.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return cid

def list_checkpoints(project_id: str | None = None) -> List[Dict[str, Any]]:
    items = []
    for p in MANI.glob("ckpt_*.json"):
        try:
            m = json.loads(p.read_text(encoding="utf-8"))
            if project_id and m.get("projectId") != project_id:
                continue
            items.append({
                "id": m["id"],
                "projectId": m.get("projectId"),
                "label": m.get("label"),
                "createdAt": m.get("createdAt"),
                "fileCount": len(m.get("files", []))
            })
        except Exception:
            continue
    # 최신순
    items.sort(key=lambda x: x["createdAt"], reverse=True)
    return items


def _restore_apply(manifest: Dict[str, Any]) -> None:
    # 워크스페이스에서 관리 대상 파일만 깔끔히 정리
    keep = {f["path"] for f in manifest.get("files", [])}
    for p in Path(WORKSPACE).rglob("*"):
        if ".contextpanel" in p.parts:
            continue
        if p.is_file():
            rel = str(p.relative_to(WORKSPACE)).replace("\\","/")
            if rel not in keep:
                p.unlink()
    # 파일 복원
    for f in manifest.get("files", []):
        blob = BLOBS/f["sha"][:2]/f["sha"]
        dst = (Path(WORKSPACE)/f["path"]).resolve()
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(blob, dst)