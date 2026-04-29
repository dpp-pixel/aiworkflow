# main/anchor_utils/ai_anchor.py
"""AI용 앵커 - 내부 시스템/AI 작업에서 사용하는 고정된 식별자"""
import re

def normalize_ai_signature(sig: str) -> str:
    """AI/시스템 내부용 시그니처 정규화

    - 접근자, static 제거
    - 제네릭 제거 (<T>)
    - throws 제거
    - 파라미터에서 타입만 남기기 (변수명 제거)
    - 공백 정리

    예: "public static String parse(String input)"
    → "String parse(String)"
    """
    # 접근자, static 제거
    s = re.sub(r"\b(public|private|protected|static|final|abstract|synchronized)\b", "", sig)

    # 제네릭 제거
    s = re.sub(r"<[^>]+>", "", s)

    # throws 제거
    s = re.sub(r"throws\s+[A-Za-z0-9_.]+", "", s)

    # 타입 + 변수명 → 타입만 남기기
    # 예: "String input" → "String"
    s = re.sub(r"([A-Za-z0-9_.$\[\]]+)\s+[A-Za-z0-9_]+", r"\1", s)

    # 공백 정리
    s = re.sub(r"\s+", " ", s).strip()
    return s


def ai_anchor(pkg: str, class_name: str, sig: str) -> str:
    """AI/시스템 내부에서 사용하는 고정된 식별자 앵커

    Args:
        pkg: 패키지명
        class_name: 클래스명
        sig: 메서드 시그니처

    Returns:
        AI 앵커 (예: "m:com.example.Parser.parse(String)")

    예제:
        ai_anchor("com.example", "Parser", "public static String parse(String input)")
        → "m:com.example.Parser.parse(String)"
    """
    sig_norm = normalize_ai_signature(sig)
    fqcn = f"{pkg}.{class_name}" if pkg else class_name
    return f"m:{fqcn}.{sig_norm}"
