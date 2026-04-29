# main/java_indexer.py
from pathlib import Path
import re
from typing import Dict, Any, List, Tuple
from .anchor_utils import anchor_pkg, anchor_cls, anchor_field, anchor_method, normalize_method_signature

# 정규식 패턴들
PKG_RE = re.compile(r"^\s*package\s+([a-zA-Z0-9_$.]+)\s*;", re.M)
CLASS_RE = re.compile(r"\b(class|interface|enum|record)\s+([A-Za-z_][$\w]*)")

# 메서드 시그니처 정규식 (애너테이션 허용 + 관대)
METHOD_SIG_RE = re.compile(
    r"""(?P<sig>
        (?:@\w+(?:\([^)]*\))?\s+)*  # 애너테이션들 (@Override, @Nullable 등)
        (?:public|protected|private|static|final|abstract|synchronized|native|default|strictfp|\s)+?
        [\w\[\]<>.?]+\s+  # 리턴 타입
        [A-Za-z_][$\w]*   # 메서드명
        \s*\([^;{]*\)     # (인자들)
        (?:\s*throws\s+[^{]+)?  # 선택적 throws
    )\s*\{""",
    re.X
)

# 필드 정규식 (간단한 버전)
FIELD_RE = re.compile(
    r"""(?P<modifiers>(?:public|protected|private|static|final|\s)+)?
        (?P<type>[\w\[\]<>.?]+)\s+
        (?P<name>[A-Za-z_][$\w]*)\s*
        (?:=\s*[^;]+)?\s*;""",
    re.X | re.M
)

def _find_package(text: str) -> str:
    """소스 코드에서 패키지명 추출"""
    match = PKG_RE.search(text)
    return match.group(1) if match else ""

def _iter_classes(text: str) -> List[Tuple[str, int]]:
    """클래스명과 시작 위치 반환"""
    return [(m.group(2), m.start()) for m in CLASS_RE.finditer(text)]

def _find_class_block_end(text: str, start: int) -> int:
    """클래스 블록의 끝 위치 찾기 (중괄호 매칭)"""
    # 클래스 키워드 이후 첫 번째 { 찾기
    brace_start = text.find("{", start)
    if brace_start < 0:
        return len(text)
    
    i = brace_start + 1
    depth = 1
    while i < len(text) and depth > 0:
        c = text[i]
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
        i += 1
    
    return i if depth == 0 else len(text)

def _find_methods(text: str, start: int, end: int) -> List[Tuple[str, Tuple[int,int], Tuple[int,int]]]:
    """클래스 블록 내에서 메서드들 찾기
    
    Returns:
        List of (signature, (start_line, start_col), (end_line, end_col))
    """
    segment = text[start:end]
    offset = start
    results = []
    
    for match in METHOD_SIG_RE.finditer(segment):
        sig = match.group("sig")

        # 메서드 본문: { 이후 매칭되는 } 까지
        # 정규식이 이미 \{로 끝나므로 match.end()-1이 { 위치
        body_start = match.end() - 1
        if body_start < 0:
            continue
            
        i = body_start + 1
        depth = 1
        while i < len(segment) and depth > 0:
            c = segment[i]
            if c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
            i += 1
        
        if depth != 0:  # 매칭되지 않은 중괄호
            continue
            
        body_end = i  # } 다음 위치
        
        # 라인/컬럼 계산
        pre_text = segment[:body_start]
        body_text = segment[body_start:body_end]
        
        start_line = pre_text.count("\n")
        start_col = len(pre_text.split("\n")[-1])
        
        end_line = start_line + body_text.count("\n")
        end_col = len(body_text.split("\n")[-1])
        
        results.append((sig.strip(), (start_line, start_col), (end_line, end_col)))
    
    # 파일 레벨 좌표로 조정
    full_pre_text = text[:offset]
    base_line = full_pre_text.count("\n")
    
    adjusted_results = []
    for sig, (sl, sc), (el, ec) in results:
        adjusted_results.append((
            sig,
            (base_line + sl, sc),
            (base_line + el, ec)
        ))
    
    return adjusted_results

def _mask_method_bodies(segment: str) -> str:
    """메서드 본문 구간을 공백으로 마스킹하여 FIELD_RE가 로컬 변수를 잡지 않도록 함"""
    masked = list(segment)

    for match in METHOD_SIG_RE.finditer(segment):
        # 정규식이 \{로 끝나므로 match.end()-1이 { 위치
        brace_open = match.end() - 1
        if brace_open < 0:
            continue

        i = brace_open + 1
        depth = 1
        while i < len(segment) and depth > 0:
            c = segment[i]
            if c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
            i += 1

        if depth == 0:
            # 메서드 본문 영역을 공백으로 대체
            for k in range(brace_open, i):
                masked[k] = " "

    return "".join(masked)

def _find_fields(text: str, start: int, end: int) -> List[str]:
    """클래스 블록 내에서 필드들 찾기 (메서드 본문 제외)"""
    segment = text[start:end]
    # 메서드 본문을 마스킹하여 로컬 변수가 필드로 잘못 잡히지 않도록 함
    segment_wo_methods = _mask_method_bodies(segment)
    results = []

    for match in FIELD_RE.finditer(segment_wo_methods):
        modifiers = match.group("modifiers") or ""
        field_type = match.group("type")
        field_name = match.group("name")

        # 메서드가 아닌 것만 (간단 체크)
        if "(" not in match.group(0):
            results.append(f"{modifiers.strip()} {field_type} {field_name}".strip())

    return results

def index_workspace(workspace: Path) -> Dict[str, Any]:
    """워크스페이스의 모든 .java 파일을 인덱싱

    Returns:
        {
            "packages": [
                {
                    "id": "pkg:com.example",
                    "name": "com.example",
                    "classes": [
                        {
                            "id": "cls:com.example.Parser",
                            "name": "Parser",
                            "fqcn": "com.example.Parser",
                            "file": "src/main/java/com/example/Parser.java",
                            "metrics": {},
                            "methods": [...],
                            "fields": [...]
                        }
                    ]
                }
            ],
            "relations": []
        }
    """
    # 제외할 디렉토리
    EXCLUDE_DIRS = {"build", "out", "bin", "target", ".git", "backup", "node_modules"}

    java_files = list(workspace.rglob("*.java"))

    # 패키지별로 그룹화
    by_package: Dict[str, Dict[str, Any]] = {}

    # FQCN 중복 체크용
    seen_fqcn: Dict[str, str] = {}  # {fqcn: file_path}

    for java_file in java_files:
        # 제외 디렉토리 필터링
        if any(part in EXCLUDE_DIRS for part in java_file.parts):
            continue

        try:
            text = java_file.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue

        package = _find_package(text)
        class_positions = _iter_classes(text)
        
        for idx, (class_name, class_pos) in enumerate(class_positions):
            # FQCN 중복 체크
            class_fqcn = f"{package}.{class_name}" if package else class_name
            if class_fqcn in seen_fqcn:
                # 이미 인덱싱한 클래스는 skip
                continue
            seen_fqcn[class_fqcn] = str(java_file.relative_to(workspace))

            # 클래스 블록 끝 찾기 - 모든 클래스는 중괄호 매칭으로 정확히 찾음
            class_end = _find_class_block_end(text, class_pos)

            # 메서드와 필드 추출
            methods = _find_methods(text, class_pos, class_end)
            fields = _find_fields(text, class_pos, class_end)

            # 앵커 생성
            pkg_id = anchor_pkg(package) if package else "pkg:"
            cls_id = anchor_cls(package, class_name)
            
            # 패키지 딕셔너리 초기화
            if pkg_id not in by_package:
                by_package[pkg_id] = {
                    "id": pkg_id,
                    "name": package,
                    "classes": []
                }
            
            # 메서드 요약 생성
            method_summaries = []
            for sig, (sl, sc), (el, ec) in methods:
                loc = el - sl + 1

                # 공식 메서드 앵커 (시스템 전반 공통)
                method_id = anchor_method(package, class_name, sig)

                # UI 표시용 정규화된 시그니처
                normalized_sig = normalize_method_signature(sig)

                method_summary = {
                    "id": method_id,              # 공식 앵커 (m:com.example.Parser.String parseTokens(String))
                    "sig": normalized_sig,        # 정규화된 시그니처 (UI 표시용)
                    "loc": loc,
                    "collapsed": loc > 20,  # 기본값, 나중에 파라미터로 조정
                    "preview": f"{normalized_sig} {{ ... }}",
                    "range": {
                        "start": [sl, sc],
                        "end": [el, ec]
                    }
                }
                method_summaries.append(method_summary)
            
            # 필드 요약 생성  
            field_summaries = []
            for field_decl in fields:
                field_name = field_decl.split()[-1]  # 마지막 토큰이 필드명
                field_summaries.append({
                    "id": anchor_field(package, class_name, field_name),
                    "name": field_name,
                    "declaration": field_decl
                })
            
            # 클래스 정보 추가
            by_package[pkg_id]["classes"].append({
                "id": cls_id,
                "name": class_name,
                "fqcn": f"{package}.{class_name}" if package else class_name,
                "file": str(java_file.relative_to(workspace)),
                "metrics": {},  # 향후 확장용
                "methods": method_summaries,
                "fields": field_summaries
            })
    
    return {
        "packages": list(by_package.values()),
        "relations": []  # 0단계에서는 관계 분석 없음
    }