# main/graph_utils.py
from __future__ import annotations
from pathlib import Path
from typing import Dict, Any, List, Tuple, Optional, Set
import re

from .utils import WORKSPACE
from .indexers import for_file
from .compare_utils import load_state_files, compare_states
from .relations_utils import build_relations_basic

IMPORT_RE = re.compile(r"^\s*import\s+([A-Za-z0-9_$.]+)\s*;", re.M)
CLASS_HDR_RE = re.compile(
    r"\b(class|interface|enum)\s+([A-Za-z_]\w*)"
    r"(?:\s+extends\s+([A-Za-z0-9_$.<>,\s]+))?"
    r"(?:\s+implements\s+([A-Za-z0-9_$.<>,\s]+))?",
    re.S
)

def _strip_generics(name: str) -> str:
    return re.sub(r"<.*?>", "", name).strip()

def _imports_map(text: str) -> Dict[str, str]:
    m: Dict[str, str] = {}
    for fq in IMPORT_RE.findall(text):
        if fq.endswith(".*"):  # 와일드카드는 해석 생략(MVP)
            continue
        simple = fq.split(".")[-1]
        m[simple] = fq
    return m

def _resolve_type(simple_or_fq: str, pkg: str, imports: Dict[str, str]) -> str:
    t = _strip_generics(simple_or_fq)
    if "." in t:   # 이미 FQCN
        return t
    if t in imports:
        return imports[t]
    return f"{pkg}.{t}" if pkg else t

def _class_relations_in_text(text: str, file_path: Path = None) -> List[Tuple[str, str, str]]:
    """
    return list of (kind, srcFQCN, dstFQCN) with kind in {'extends','implements'}
    """
    ws = Path(WORKSPACE)
    fp = file_path or ws
    indexer = for_file(fp)
    pkg = indexer.get_namespace(text, fp, ws) if indexer else ""
    imap = _imports_map(text)
    rels: List[Tuple[str, str, str]] = []
    for m in CLASS_HDR_RE.finditer(text):
        cls_name = m.group(2)
        src = f"{pkg}.{cls_name}" if pkg else cls_name
        ex = m.group(3) or ""
        im = m.group(4) or ""
        if ex.strip():
            for token in [x.strip() for x in ex.split(",") if x.strip()]:
                rels.append(("extends", src, _resolve_type(token, pkg, imap)))
        if im.strip():
            for token in [x.strip() for x in im.split(",") if x.strip()]:
                rels.append(("implements", src, _resolve_type(token, pkg, imap)))
    return rels

def _current_classes_and_packages() -> Tuple[Dict[str, Dict[str, Any]], Dict[str, Dict[str, Any]]]:
    """
    returns:
      classes: {fqcn -> {id,label,pkg,file}}
      packages:{name -> {id,label}}
    """
    from .indexers import all_extensions
    classes: Dict[str, Dict[str, Any]] = {}
    packages: Dict[str, Dict[str, Any]] = {}
    ws = Path(WORKSPACE)
    for ext in all_extensions():
        for p in ws.rglob(f"*{ext}"):
            indexer = for_file(p)
            if not indexer:
                continue
            text = p.read_text(encoding="utf-8", errors="ignore")
            pkg = indexer.get_namespace(text, p, ws)

            # vo 패키지 필터링 (임시로 숨김)
            if pkg and ".vo" in pkg:
                continue

            packages.setdefault(pkg, {"id": f"pkg:{pkg}", "label": pkg or ""})
            for unit in indexer.get_units(text):
                cls_name = unit["name"]
                fq = f"{pkg}.{cls_name}" if pkg else cls_name
                classes[fq] = {
                    "id": f"cls:{fq}",
                    "label": cls_name,
                    "pkg": pkg,
                    "file": str(p.relative_to(ws)).replace("\\", "/")
                }
    return classes, packages

def _edges_extends_implements() -> List[Dict[str, str]]:
    from .indexers import all_extensions
    edges: List[Dict[str, str]] = []
    ws = Path(WORKSPACE)
    for ext in all_extensions():
        for p in ws.rglob(f"*{ext}"):
            text = p.read_text(encoding="utf-8", errors="ignore")
            for kind, src_fq, dst_fq in _class_relations_in_text(text, p):
                edges.append({
                    "source": f"cls:{src_fq}",
                    "target": f"cls:{dst_fq}",
                    "kind": kind
                })
    return edges

def _overlay_class_level(baseline: Optional[str]) -> Dict[str, str]:
    """
    method-level compare 결과를 클래스 레벨 overlay로 집계.
    returns {clsId -> 'added'|'modified'|'removed'}
    """
    if not baseline:
        return {}
    ov = compare_states(baseline, "working")
    status: Dict[str, str] = {}
    # 우선순위: removed > added > modified (removed 노드는 현재엔 없지만 표시용으로 유지)
    prio = {"removed": 3, "added": 2, "modified": 1}
    def class_from_method_anchor(a: str) -> str:
        # m:com.example.Text.String parse(String) -> cls:com.example.Text
        rest = a.split(":",1)[1]
        head = rest.split(" ",1)[0]          # com.example.Text.String
        cls_fq = head.rsplit(".", 1)[0]      # com.example.Text
        return f"cls:{cls_fq}"
    for c in ov.get("changes", []):
        cls_id = class_from_method_anchor(c["anchor"])
        k = c["kind"]
        prev = status.get(cls_id)
        if (not prev) or (prio[k] > prio[prev]):
            status[cls_id] = k
    return status

def build_graph(level: str = "class", baseline: Optional[str] = None,
                kinds: Optional[Set[str]] = None) -> Dict[str, Any]:
    kinds = kinds or {"extends", "implements"}  # 기본은 상속/구현
    print(f"[DEBUG] build_graph called with kinds: {kinds}", flush=True)
    classes, packages = _current_classes_and_packages()
    overlay_map = _overlay_class_level(baseline)

    # --- 엣지 구성 함수 ---
    def class_edges_all() -> List[Dict[str, str]]:
        out: List[Dict[str, str]] = []
        if {"extends","implements"} & kinds:
            for e in _edges_extends_implements():
                if e["kind"] in kinds:
                    out.append(e)
        if {"calls","references"} & kinds:
            for r in build_relations_basic():
                if r["kind"] in kinds and str(r["from"]).startswith("cls:") and str(r["to"]).startswith("cls:"):
                    out.append({"source": r["from"], "target": r["to"], "kind": r["kind"]})
        # 중복 제거
        seen = set(); dedup = []
        for e in out:
            key = (e["source"], e["target"], e["kind"])
            if key in seen: continue
            seen.add(key); dedup.append(e)
        return dedup

    # 노드 구성
    if level == "package":
        nodes = [{"id": v["id"], "kind": "package", "label": v["label"],
                  "overlay": None} for v in packages.values()]
        # 패키지 오버레이: 클래스 오버레이를 패키지로 승격
        pkg_overlay = {}
        for cls_id, okind in overlay_map.items():
            fq = cls_id.split(":",1)[1]              # com.example.Text
            pkg = fq.rsplit(".",1)[0] if "." in fq else ""
            pid = f"pkg:{pkg}"
            # added/modified만 표시 (removed는 현재 노드엔 없을 수 있음)
            pkg_overlay[pid] = pkg_overlay.get(pid) or okind
        for n in nodes:
            if n["id"] in pkg_overlay:
                n["overlay"] = pkg_overlay[n["id"]]
        # 엣지: 클래스 관계를 패키지 레벨로 축약(패키지 다르면 엣지)
        # 패키지 레벨에서는 모든 관계를 먼저 수집한 후 필터링
        ce = class_edges_all()
        print(f"[DEBUG] Package level - class_edges_all returned {len(ce)} edges", flush=True)
        # 엣지 kind 분포 확인
        kind_counts = {}
        for e in ce:
            kind_counts[e["kind"]] = kind_counts.get(e["kind"], 0) + 1
        print(f"[DEBUG] Package level - edge kinds: {kind_counts}", flush=True)

        edges_pkg = []
        seenp = set()
        # 패키지 레벨에서 얇은 선(calls, references, cohesion)은 제외
        pkg_exclude_kinds = {"calls", "references", "cohesion"}
        for e in ce:
            # 얇은 선 종류는 패키지 레벨에서 제외
            if e["kind"] in pkg_exclude_kinds:
                continue
            s_fq = e["source"].split(":",1)[1]; t_fq = e["target"].split(":",1)[1]
            s_pkg = s_fq.rsplit(".",1)[0] if "." in s_fq else ""
            t_pkg = t_fq.rsplit(".",1)[0] if "." in t_fq else ""
            if s_pkg == t_pkg:
                print(f"[DEBUG] Skipping same package: {s_pkg} -> {t_pkg} ({e['kind']})", flush=True)
                continue
            key = (s_pkg, t_pkg, e["kind"])
            if key in seenp: continue
            seenp.add(key)
            edges_pkg.append({"source": f"pkg:{s_pkg}", "target": f"pkg:{t_pkg}", "kind": e["kind"]})
        print(f"[DEBUG] Package level - created {len(edges_pkg)} package edges", flush=True)
        return {"level": "package", "nodes": nodes, "edges": edges_pkg}

    # class level
    nodes = []
    for fq, v in classes.items():
        n = {"id": v["id"], "kind": "class", "label": v["label"],
             "parent": f"pkg:{v['pkg']}", "overlay": overlay_map.get(v["id"])}
        nodes.append(n)

    # removed 클래스(현재 워킹엔 없지만 오버레이로 보고 싶은 경우)를 '유령' 노드로 추가
    for cls_id, okind in overlay_map.items():
        if cls_id not in {n["id"] for n in nodes} and okind == "removed":
            fq = cls_id.split(":",1)[1]
            pkg = fq.rsplit(".",1)[0] if "." in fq else ""
            nodes.append({"id": cls_id, "kind": "class", "label": fq.split(".")[-1],
                          "parent": f"pkg:{pkg}", "overlay": "removed", "ghost": True})

    # 엣지(extends/implements/calls/references). 대상 클래스가 워크스페이스에 없으면 생략
    class_ids = {n["id"] for n in nodes}
    edges = [e for e in class_edges_all() if e["source"] in class_ids and e["target"] in class_ids]

    return {"level": "class", "nodes": nodes, "edges": edges}

