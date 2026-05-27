# main/checkpoint_utils.py
from __future__ import annotations
from pathlib import Path
import hashlib, json, time, shutil
from typing import Dict, Any, List

from .utils import WORKSPACE


def _sha_bytes(b: bytes) -> str:
    return hashlib.sha1(b).hexdigest()


def _ckpt_root() -> Path:
    ws = str(WORKSPACE)
    if not ws:
        raise RuntimeError("workspace not set")
    return Path(ws) / ".contextpanel" / "checkpoints"

def _blobs() -> Path:
    p = _ckpt_root() / "blobs"
    p.mkdir(parents=True, exist_ok=True)
    return p

def get_mani() -> Path:
    p = _ckpt_root() / "manifests"
    p.mkdir(parents=True, exist_ok=True)
    return p

# routes.py 임포트 호환성 유지 (MANI 상수처럼 쓰던 곳)
class _ManiProxy:
    def __truediv__(self, name):
        return get_mani() / name
    def glob(self, pattern):
        return get_mani().glob(pattern)
    def __str__(self):
        return str(get_mani())

MANI = _ManiProxy()


def create_checkpoint(project_id: str, label: str = "manual", parent_id: str | None = None) -> str:
    ws = str(WORKSPACE)
    workspace_path = Path(ws)
    blobs = _blobs()
    mani  = get_mani()

    ts = time.strftime("%Y%m%d_%H%M%S")
    ts_hash = hashlib.sha1(ts.encode()).hexdigest()[:4]
    cid = f"ckpt_{ts}_{ts_hash}"

    files = []
    for p in workspace_path.rglob("*"):
        if ".contextpanel" in p.parts:
            continue
        if p.is_file():
            try:
                b = p.read_bytes()
                sha = _sha_bytes(b)
                blob_dir = blobs / sha[:2]
                blob_dir.mkdir(exist_ok=True)
                blob_path = blob_dir / sha
                if not blob_path.exists():
                    blob_path.write_bytes(b)
                files.append({
                    "path": str(p.relative_to(ws)).replace("\\", "/"),
                    "sha": sha,
                    "size": p.stat().st_size,
                })
            except Exception as e:
                print(f"Warning: Could not read file {p}: {e}")

    manifest = {
        "id": cid, "projectId": project_id, "label": label,
        "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "parentId": parent_id,
        "files": files,
    }
    (mani / f"{cid}.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return cid


def list_checkpoints(project_id: str | None = None) -> List[Dict[str, Any]]:
    try:
        mani = get_mani()
    except RuntimeError:
        return []
    items = []
    for p in mani.glob("ckpt_*.json"):
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
                "fileCount": len(m.get("files", [])),
            })
        except Exception:
            continue
    items.sort(key=lambda x: x["createdAt"], reverse=True)
    return items


def _restore_apply(manifest: Dict[str, Any]) -> None:
    ws = str(WORKSPACE)
    blobs = _blobs()
    keep = {f["path"] for f in manifest.get("files", [])}
    for p in Path(ws).rglob("*"):
        if ".contextpanel" in p.parts:
            continue
        if p.is_file():
            rel = str(p.relative_to(ws)).replace("\\", "/")
            if rel not in keep:
                p.unlink()
    for f in manifest.get("files", []):
        blob = blobs / f["sha"][:2] / f["sha"]
        dst = (Path(ws) / f["path"]).resolve()
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(blob, dst)
