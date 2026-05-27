# main/relations_utils.py
from __future__ import annotations
from pathlib import Path
from typing import Dict, Any, List, Tuple, Set
import re

from .utils import WORKSPACE
from .indexers import for_file, all_extensions

IMPORT_RE = re.compile(r"^\s*import\s+([A-Za-z0-9_$.]+)\s*;", re.M)

# 향상된 관계 감지 패턴들
# 1. 메서드 호출: Foo.bar(), this.foo.method(), obj.method()
QUAL_CALL_RE = re.compile(r"\b([A-Z][A-Za-z0-9_]*)(?:<[^>]+>)?\s*\.")

# 2. 객체 생성: new Foo(), new Foo<Type>()
NEW_EXPR_RE = re.compile(r"\bnew\s+([A-Z][A-Za-z0-9_]*)(?:<[^>]*>)?\s*\(")

# 3. 필드/변수 선언: private Foo foo, Foo foo =
FIELD_DECL_RE = re.compile(r"\b(?:private|public|protected|static|final)?\s*([A-Z][A-Za-z0-9_]*)\s+\w+\s*[=;]")

# 4. 생성자 파라미터: new Foo(Bar bar, Baz baz)
CONSTRUCTOR_PARAM_RE = re.compile(r"public\s+\w+\s*\([^)]*?([A-Z][A-Za-z0-9_]*)\s+\w+")

# 5. 메서드 파라미터: method(Foo foo, Bar bar)
METHOD_PARAM_RE = re.compile(r"(?:public|private|protected)?\s*\w+\s+\w+\s*\([^)]*?([A-Z][A-Za-z0-9_]*)\s+\w+")

# 6. 메서드 리턴 타입: public Foo getFoo()
RETURN_TYPE_RE = re.compile(r"(?:public|private|protected)\s+([A-Z][A-Za-z0-9_]*)\s+\w+\s*\(")

# 7. 제네릭 타입: List<Foo>, Map<String, Bar>
GENERIC_TYPE_RE = re.compile(r"<[^>]*([A-Z][A-Za-z0-9_]*)[^>]*>")

# 전역 클래스 인덱스: simpleName → {FQCN 후보들}
CLASS_INDEX: Dict[str, Set[str]] = {}

def _build_class_index() -> None:
    """워크스페이스의 모든 소스 파일을 스캔하여 전역 클래스 인덱스 구축"""
    global CLASS_INDEX
    CLASS_INDEX = {}
    ws = Path(WORKSPACE)
    for ext in all_extensions():
        for p in ws.rglob(f"*{ext}"):
            indexer = for_file(p)
            if not indexer:
                continue
            text = p.read_text(encoding="utf-8", errors="ignore")
            pkg = indexer.get_namespace(text, p, ws)
            for unit in indexer.get_units(text):
                cls = unit["name"]
                fq = f"{pkg}.{cls}" if pkg else cls
                CLASS_INDEX.setdefault(cls, set()).add(fq)

def _imports_map(text: str) -> Dict[str, str]:
    m: Dict[str, str] = {}
    # 와일드카드 패키지 목록 수집
    m["__wildcards__"] = []
    for fq in IMPORT_RE.findall(text):
        if fq.endswith(".*"):
            pkg_prefix = fq[:-2]
            m["__wildcards__"].append(pkg_prefix)
            continue
        simple = fq.split(".")[-1]
        m[simple] = fq
    return m

def _resolve(simple_or_fq: str, pkg: str, imap: Dict[str, str]) -> str:
    """강화된 타입 해석: 전역 인덱스 + 와일드카드 import 활용"""
    # 이미 FQCN 형태면 그대로
    if "." in simple_or_fq:
        return simple_or_fq

    # 1) 명시적 import 우선
    if simple_or_fq in imap:
        return imap[simple_or_fq]

    # 2) 와일드카드 import 패키지 내 후보 탐색 (단일 후보일 때만)
    for wpkg in imap.get("__wildcards__", []):
        cands = [fq for fq in CLASS_INDEX.get(simple_or_fq, set()) if fq.startswith(wpkg + ".")]
        if len(cands) == 1:
            return cands[0]

    # 3) 전역 인덱스에서 단일 후보면 채택
    g = CLASS_INDEX.get(simple_or_fq, set())
    if len(g) == 1:
        return next(iter(g))

    # 4) 같은 상위 도메인 우선(예: com.ecommerce.* 라인이면 그쪽 후보 선호)
    if g:
        for fq in g:
            if pkg and fq.startswith(pkg.split(".")[0] + "."):
                return fq

    # 5) 최후: 같은 파일 패키지로 보수적 추정
    return f"{pkg}.{simple_or_fq}" if pkg else simple_or_fq

def build_relations_basic() -> List[Dict[str, Any]]:
    """
    returns RelationEdge[] for 기본 화면:
      kind ∈ {"extends","implements","calls","references","cohesion"}
      from/to: cls:... (클래스 앵커)
      examples: ["Foo.bar","new Baz"]
    """
    edges: List[Dict[str, Any]] = []
    seen: Set[Tuple[str, str, str]] = set()

    # ★ 전역 인덱스 구축 (한 번만)
    _build_class_index()

    ws = Path(WORKSPACE)

    # 1) 클래스/패키지 맵 생성 (FQCN 인식)
    fq_by_file: Dict[str, List[str]] = {}
    for ext in all_extensions():
        for p in ws.rglob(f"*{ext}"):
            indexer = for_file(p)
            if not indexer:
                continue
            text = p.read_text(encoding="utf-8", errors="ignore")
            pkg = indexer.get_namespace(text, p, ws)
            for unit in indexer.get_units(text):
                cls = unit["name"]
                fq = f"{pkg}.{cls}" if pkg else cls
                fq_by_file.setdefault(str(p), []).append(fq)

    # 2) extends/implements (재사용)
    from .graph_utils import _class_relations_in_text
    for ext in all_extensions():
        for p in ws.rglob(f"*{ext}"):
            text = p.read_text(encoding="utf-8", errors="ignore")
            for kind, src_fq, dst_fq in _class_relations_in_text(text, p):
                key = (src_fq, dst_fq, kind)
                if key in seen:
                    continue
                seen.add(key)
                edges.append({
                    "from": f"cls:{src_fq}",
                    "to":   f"cls:{dst_fq}",
                    "kind": kind
                })

    # 3) calls/references (정적 호출 + new 표현만 잡는 가벼운 휴리스틱)
    for ext in all_extensions():
      for p in ws.rglob(f"*{ext}"):
        indexer = for_file(p)
        if not indexer:
            continue
        text = p.read_text(encoding="utf-8", errors="ignore")
        pkg = indexer.get_namespace(text, p, ws)
        imap = _imports_map(text)

        # 이 파일 안의 source 클래스들
        src_fqs = fq_by_file.get(str(p), [])
        if not src_fqs:
            continue

        # 기본 자바 타입 및 컬렉션 제외 리스트
        java_builtin = {
            "String", "Integer", "Boolean", "Long", "Double", "Float", "Short", "Byte", "Character",
            "List", "ArrayList", "Map", "HashMap", "Set", "HashSet", "LinkedList", "TreeMap", "TreeSet",
            "Collection", "Vector", "Stack", "Queue", "Deque", "Properties", "Date", "Calendar",
            "Logger", "Exception", "RuntimeException", "Object", "Class", "Thread", "Runnable"
        }

        def add_relation(simple: str, kind: str, example: str = None):
            if simple in java_builtin:
                return
            dst_fq = _resolve(simple, pkg, imap)
            for src_fq in src_fqs:
                if src_fq == dst_fq:  # 자기 자신 제외
                    continue
                if (src_fq, dst_fq, kind) in seen:
                    continue
                seen.add((src_fq, dst_fq, kind))
                edges.append({
                    "from": f"cls:{src_fq}",
                    "to": f"cls:{dst_fq}",
                    "kind": kind,
                    "examples": [example or f"{kind}: {simple}"]
                })

        # 1. 객체 생성: new Foo()
        for m in NEW_EXPR_RE.finditer(text):
            simple = m.group(1)
            add_relation(simple, "references", f"new {simple}()")

        # 2. 필드/변수 선언: private Foo foo
        for m in FIELD_DECL_RE.finditer(text):
            simple = m.group(1)
            add_relation(simple, "references", f"field: {simple}")

        # 3. 생성자 파라미터: Foo(Bar bar)
        for m in CONSTRUCTOR_PARAM_RE.finditer(text):
            simple = m.group(1)
            add_relation(simple, "references", f"constructor param: {simple}")

        # 4. 메서드 파라미터: method(Foo foo)
        for m in METHOD_PARAM_RE.finditer(text):
            simple = m.group(1)
            add_relation(simple, "references", f"method param: {simple}")

        # 5. 메서드 리턴 타입: public Foo getFoo()
        for m in RETURN_TYPE_RE.finditer(text):
            simple = m.group(1)
            add_relation(simple, "references", f"return type: {simple}")

        # 6. 정적/인스턴스 메서드 호출: Foo.bar(), obj.method()
        for m in QUAL_CALL_RE.finditer(text):
            simple = m.group(1)
            add_relation(simple, "calls", f"{simple}.method()")

        # 7. 제네릭 타입: List<Foo>
        for m in GENERIC_TYPE_RE.finditer(text):
            simple = m.group(1)
            add_relation(simple, "references", f"generic: {simple}")

    # ★ 같은 패키지 결속력 추가
    _add_same_package_cohesion(edges, seen)

    return edges

def _add_same_package_cohesion(edges: List[Dict[str, Any]], seen: Set[Tuple[str, str, str]]):
    """같은 패키지 내 클래스들을 약한 연결로 묶어 전체 연결성 향상"""
    # 패키지별 대표 클래스 하나 선택 (첫 번째 클래스)
    pkg_rep: Dict[str, str] = {}
    for cls, fqs in CLASS_INDEX.items():
        for fq in fqs:
            pkg = ".".join(fq.split(".")[:-1])
            if pkg and pkg not in pkg_rep:
                pkg_rep[pkg] = fq

    # 같은 패키지의 다른 클래스들을 대표에 연결 (cohesion)
    for cls, fqs in CLASS_INDEX.items():
        for fq in fqs:
            pkg = ".".join(fq.split(".")[:-1])
            rep = pkg_rep.get(pkg)
            if not pkg or not rep or rep == fq:
                continue
            key = (fq, rep, "cohesion")
            if key in seen:
                continue
            seen.add(key)
            edges.append({
                "from": f"cls:{fq}",
                "to": f"cls:{rep}",
                "kind": "cohesion",
                "examples": ["same package"]
            })