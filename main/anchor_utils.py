# main/anchor_utils.py
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

def anchor_method(package: str, class_name: str, sig: str) -> str:
    """메서드 앵커 ID 생성
    
    Args:
        package: 패키지명
        class_name: 클래스명  
        sig: 메서드 시그니처 (예: "String parse(String s)")
    
    Returns:
        메서드 앵커 ID (예: "m:com.example.Parser.String parse(String)")
    """
    # 시그니처 정규화
    sig = norm_space(sig)
    sig = re.sub(r"\s*,\s*", ",", sig)          # 인자 콤마 주변 공백 제거
    sig = re.sub(r"\s*\)\s*$", ")", sig)        # 끝 괄호 뒤 공백 제거
    
    # 파라미터명 제거: "Type name" -> "Type"
    def drop_param_names(args: str) -> str:
        parts = []
        for arg in [x.strip() for x in args.split(",") if x.strip()]:
            # 제네릭/배열은 유지하고 마지막 식별자만 제거
            clean_arg = re.sub(r"\b[_$a-zA-Z][_$a-zA-Z0-9]*$", "", arg).strip()
            parts.append(clean_arg)
        return ",".join(parts)
    
    # 메서드 시그니처 파싱: "returnType methodName(args)"
    match = re.match(r"(.+?\s+)?([_$a-zA-Z][_$a-zA-Z0-9]*)\s*\((.*)\)", sig)
    if match:
        ret_and_name = sig[:sig.index("(")].strip()
        args = drop_param_names(match.group(3))
        clean_sig = f"{ret_and_name}({args})"
    else:
        clean_sig = sig
    
    return f"m:{fqcn(package, class_name)}.{clean_sig}"

def anchor_field(package: str, class_name: str, field_name: str) -> str:
    """필드 앵커 ID 생성"""
    return f"f:{fqcn(package, class_name)}.{field_name}"

def symbol_hash(decl: str) -> str:
    """심볼 선언의 해시값 생성 (8자리)"""
    return hashlib.sha1(norm_space(decl).encode()).hexdigest()[:8]