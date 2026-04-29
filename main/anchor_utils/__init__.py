# main/anchor_utils/__init__.py
import re
import hashlib

def norm_space(s: str) -> str:
    """공백 정규화 (여러 공백을 하나로)"""
    return re.sub(r"\s+", " ", s.strip())

def fqcn(package: str, class_name: str) -> str:
    """Full Qualified Class Name 생성"""
    return f"{package}.{class_name}" if package else class_name

def anchor_pkg(package: str) -> str:
    """패키지 앵커 ID 생성"""
    return f"pkg:{package}"

def anchor_cls(package: str, class_name: str) -> str:
    """클래스 앵커 ID 생성"""
    return f"cls:{fqcn(package, class_name)}"

def anchor_field(package: str, class_name: str, field_name: str) -> str:
    """필드 앵커 ID 생성"""
    return f"f:{fqcn(package, class_name)}.{field_name}"

def symbol_hash(decl: str) -> str:
    """심볼 선언의 해시값 생성 (8자리)"""
    return hashlib.sha1(norm_space(decl).encode()).hexdigest()[:8]

def normalize_method_signature(sig: str) -> str:
    """메서드 시그니처 정규화 (메서드 이름 유지)

    예: "public String parseTokens(String input, int mode)"
    → "String parseTokens(String,int)"
    """
    # 1. 접근자, static 등 제거
    s = re.sub(r"\b(public|private|protected|static|final|abstract|synchronized|native|default|strictfp)\b", "", sig)

    # 2. 애너테이션 제거
    s = re.sub(r"@\w+(\([^)]*\))?\s*", "", s)

    # 3. throws 제거
    s = re.sub(r"\s*throws\s+[\w\s,$.]+", "", s)

    # 4. 제네릭 제거
    s = re.sub(r"<[^>]+>", "", s)

    # 5. 메서드 이름과 파라미터 분리
    # 패턴: 리턴타입 메서드명(파라미터들)
    match = re.match(r"\s*([\w\[\].$]+)\s+([\w$]+)\s*\(([^)]*)\)", s.strip())
    if not match:
        # 파싱 실패 시 공백만 정리해서 반환
        return re.sub(r"\s+", " ", s).strip()

    return_type = match.group(1).strip()
    method_name = match.group(2).strip()
    params = match.group(3).strip()

    # 6. 파라미터 정규화: 타입만 남기고 변수명 제거
    if params:
        # 파라미터를 콤마로 분리
        param_list = [p.strip() for p in params.split(",")]
        # 각 파라미터에서 타입만 추출 (마지막 공백 전까지)
        normalized_params = []
        for p in param_list:
            # "String input" → "String"
            parts = p.split()
            if parts:
                normalized_params.append(parts[0])
        params = ",".join(normalized_params)

    return f"{return_type} {method_name}({params})"

def anchor_method(package: str, class_name: str, sig: str) -> str:
    """공식 메서드 앵커 생성

    Args:
        package: 패키지명
        class_name: 클래스명
        sig: 메서드 시그니처

    Returns:
        메서드 앵커 (예: "m:com.example.Parser.String parseTokens(String,int)")

    예제:
        anchor_method("com.example", "Parser", "public String parseTokens(String input, int mode)")
        → "m:com.example.Parser.String parseTokens(String,int)"
    """
    clean_sig = normalize_method_signature(sig)
    return f"m:{fqcn(package, class_name)}.{clean_sig}"

# ui_anchor와 ai_anchor는 별도 모듈에서 import
from .ui_anchor import ui_anchor
from .ai_anchor import ai_anchor

__all__ = [
    'norm_space',
    'fqcn',
    'anchor_pkg',
    'anchor_cls',
    'anchor_field',
    'symbol_hash',
    'normalize_method_signature',
    'anchor_method',
    'ui_anchor',
    'ai_anchor'
]
