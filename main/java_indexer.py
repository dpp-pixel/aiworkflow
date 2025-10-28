# main/java_indexer.py
from pathlib import Path
import re
from typing import Dict, Any, List, Tuple
from .anchor_utils import anchor_pkg, anchor_cls, anchor_method, anchor_field

# 정규식 패턴들
PKG_RE = re.compile(r"^\s*package\s+([a-zA-Z0-9_$.]+)\s*;", re.M)
CLASS_RE = re.compile(r"\b(class|interface|enum)\s+([A-Za-z_][$\w]*)")

# 메서드 시그니처 정규식 (매우 관대하게)
METHOD_SIG_RE = re.compile(
    r"""(?P<sig>
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
        body_start = segment.find("{", match.end() - len(segment))
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

def _find_fields(text: str, start: int, end: int) -> List[str]:
    """클래스 블록 내에서 필드들 찾기 (간단한 버전)"""
    segment = text[start:end]
    results = []
    
    for match in FIELD_RE.finditer(segment):
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
    java_files = list(workspace.rglob("*.java"))
    
    # 패키지별로 그룹화
    by_package: Dict[str, Dict[str, Any]] = {}
    
    for java_file in java_files:
        try:
            text = java_file.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
            
        package = _find_package(text)
        class_positions = _iter_classes(text)
        
        for idx, (class_name, class_pos) in enumerate(class_positions):
            # 클래스 블록 끝 찾기
            if idx + 1 < len(class_positions):
                class_end = class_positions[idx + 1][1]
            else:
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
                method_summary = {
                    "id": anchor_method(package, class_name, sig),
                    "sig": sig,
                    "loc": loc,
                    "collapsed": loc > 20,  # 기본값, 나중에 파라미터로 조정
                    "preview": re.sub(r"\s+", " ", sig) + " { ... }",
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