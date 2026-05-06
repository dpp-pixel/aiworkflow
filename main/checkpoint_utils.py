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

def create_checkpoint(project_id: str, label: str = "manual", parent_id: str | None = None) -> str:
    """
    현재 워크스페이스의 모든 파일을 체크포인트로 저장

    Args:
        project_id: 프로젝트 ID
        label: 체크포인트 라벨
        parent_id: 부모 체크포인트 ID (트리 구조용)

    Returns:
        생성된 체크포인트 ID
    """
    ts = time.strftime("%Y%m%d_%H%M%S")
    ts_hash = hashlib.sha1(ts.encode()).hexdigest()[:4]
    cid = f"ckpt_{ts}_{ts_hash}"

    files = []
    workspace_path = Path(WORKSPACE)

    for p in workspace_path.rglob("*"):
        if ".contextpanel" in p.parts:
            continue
        if p.is_file():
            try:
                b = p.read_bytes()
                sha = _sha_bytes(b)

                blob_dir = BLOBS / sha[:2]
                blob_dir.mkdir(exist_ok=True)
                blob_path = blob_dir / sha

                if not blob_path.exists():
                    blob_path.write_bytes(b)

                files.append({"path": str(p.relative_to(WORKSPACE)).replace("\\","/"),
                              "sha": sha, "size": p.stat().st_size})

            except Exception as e:
                print(f"Warning: Could not read file {p}: {e}")
                continue

    manifest = {
        "id": cid, "projectId": project_id, "label": label,
        "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "parentId": parent_id,
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
                "parentId": m.get("parentId"),
                "fileCount": len(m.get("files", []))
            })
        except Exception:
            continue
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