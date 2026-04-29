# main/compare_utils.py
from __future__ import annotations
from pathlib import Path
from typing import Dict, Any, Iterable
import re, json, hashlib

from .utils import WORKSPACE
from .anchor_utils import anchor_cls, anchor_pkg, anchor_method
# 내부 파서를 재사용하기 위해 java_indexer의 헬퍼를 import
from .java_indexer import _find_package, _iter_classes, _find_methods

CKPT_ROOT = (Path("./.contextpanel/checkpoints")).resolve()
BLOBS = CKPT_ROOT / "blobs"
MANI = CKPT_ROOT / "manifests"

def _norm_ws(s: str) -> str:
    """비교 노이즈 축소(공백/주석 최소화): 본문 해시용"""
    s = re.sub(r"//.*?$", "", s, flags=re.M)           # 한 줄 주석
    s = re.sub(r"/\*.*?\*/", "", s, flags=re.S)        # 블록 주석
    s = re.sub(r"\s+", " ", s).strip()
    return s

def _sha(s: str) -> str:
    return hashlib.sha1(s.encode("utf-8", "ignore")).hexdigest()

def load_state_files(state: str, scope_globs: Iterable[str] | None = None) -> Dict[str, str]:
    """
    state: 'working' | 'ckpt_xxx' | 'dir:/abs/or/relative/path'
    returns {file_path(str relative to workspace or ckpt): text}
    """
    files: Dict[str, str] = {}
    def _match(path: Path) -> bool:
        if not scope_globs: return True
        from fnmatch import fnmatch
        rel = str(path).replace("\\", "/")
        return any(fnmatch(rel, pat) for pat in scope_globs)

    if state == "working":
        for p in Path(WORKSPACE).rglob("*.java"):
            if _match(p.relative_to(WORKSPACE)):
                rel_path = str(p.relative_to(WORKSPACE)).replace("\\", "/")
                files[rel_path] = p.read_text(encoding="utf-8", errors="ignore")
        return files

    if state.startswith("dir:"):
        base = Path(state.split(":", 1)[1]).resolve()
        for p in base.rglob("*.java"):
            rel = p.relative_to(base)
            if _match(rel):
                rel_path = str(rel).replace("\\", "/")
                files[rel_path] = p.read_text(encoding="utf-8", errors="ignore")
        return files

    if state.startswith("ckpt_"):
        mani_path = MANI / f"{state}.json"
        if not mani_path.exists():
            raise FileNotFoundError(f"checkpoint manifest not found: {state}")
        mani = json.loads(mani_path.read_text(encoding="utf-8"))
        for f in mani.get("files", []):
            path = f.get("path", "")
            if not path.endswith(".java"):  # 자바만 비교
                continue
            if scope_globs:
                from fnmatch import fnmatch
                if not any(fnmatch(path, pat) for pat in scope_globs):
                    continue
            sha = f["sha"]
            blob = BLOBS / sha[:2] / sha
            if not blob.exists():  # 안전 가드
                continue
            txt = blob.read_text(encoding="utf-8", errors="ignore")
            files[path] = txt
        return files

    raise ValueError(f"unsupported state: {state}")

def index_filemap(filemap: Dict[str, str]) -> Dict[str, Any]:
    """
    filemap: {path -> text}
    returns:
      anchors: {anchorId -> {file, hash, loc, range}}
      reverse: {file -> list[anchorId]}
    """
    anchors: Dict[str, Any] = {}
    reverse: Dict[str, Any] = {}
    for path, text in filemap.items():
        package = _find_package(text)
        classes = _iter_classes(text)
        for idx, (cls_name, cls_pos) in enumerate(classes):
            cls_end = classes[idx+1][1] if idx+1 < len(classes) else len(text)
            methods = _find_methods(text, cls_pos, cls_end)
            # 클래스 앵커(필요 시 확장)
            _ = anchor_cls(package, cls_name)  # 현재는 메서드 중심 비교
            lines = text.splitlines()
            for sig, (sl, sc), (el, ec) in methods:
                # 메서드 본문 텍스트 (파일 좌표 기준 sl~el)
                body_txt = "\n".join(lines[sl:el+1])
                h = _sha(_norm_ws(body_txt))
                loc = (el - sl + 1)
                a = anchor_method(package, cls_name, sig)  # 공식 anchor 사용 (비교/diff 작업)
                anchors[a] = {
                    "file": path,
                    "hash": h,
                    "loc": loc,
                    "range": {"start": [sl, sc], "end": [el, ec]}
                }
                reverse.setdefault(path, []).append(a)
    return {"anchors": anchors, "reverse": reverse}

def compare_states(from_state: str, to_state: str, scope: Iterable[str] | None = None) -> Dict[str, Any]:
    """두 상태를 비교하여 변경사항 반환"""
    from_files = load_state_files(from_state, scope)
    to_files = load_state_files(to_state, scope)

    from_idx = index_filemap(from_files)
    to_idx = index_filemap(to_files)

    A = from_idx["anchors"]
    B = to_idx["anchors"]

    changes = []
    # added
    for a in B.keys() - A.keys():
        changes.append({"anchor": a, "kind": "added", "locDelta": B[a]["loc"], "ranges": [[
            B[a]["range"]["start"][0], B[a]["range"]["start"][1],
            B[a]["range"]["end"][0],   B[a]["range"]["end"][1]
        ]]})
    # removed
    for a in A.keys() - B.keys():
        changes.append({"anchor": a, "kind": "removed", "locDelta": -A[a]["loc"]})
    # modified
    for a in A.keys() & B.keys():
        if A[a]["hash"] != B[a]["hash"]:
            changes.append({
                "anchor": a, "kind": "modified",
                "locDelta": B[a]["loc"] - A[a]["loc"],
                "ranges": [[
                    B[a]["range"]["start"][0], B[a]["range"]["start"][1],
                    B[a]["range"]["end"][0],   B[a]["range"]["end"][1]
                ]]
            })

    # 간단 정렬: added -> modified -> removed, 그리고 앵커명
    kind_order = {"added": 0, "modified": 1, "removed": 2}
    changes.sort(key=lambda c: (kind_order.get(c["kind"], 9), c["anchor"]))

    return {"from": from_state, "to": to_state, "changes": changes}