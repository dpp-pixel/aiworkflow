# main/anchor_utils/ui_anchor.py
"""UI용 앵커 - 사람이 보기 좋은 정갈한 표시"""
import re

def normalize_ui_signature(sig: str) -> str:
    """UI 표시용 시그니처 정규화

    - 접근 지시자 제거 (public, private, protected, static, final, abstract, synchronized)
    - throws 제거
    - 제네릭 제거 (<T>)
    - 파라미터에서 타입만 남기기 (변수명 제거)
    - 공백 정리

    예: "public static String parse(String input)"
    → "String parse(String)"
    """
    # 접근지시자, static 등 제거
    s = re.sub(r"\b(public|private|protected|static|final|abstract|synchronized)\b", "", sig)

    # throws 제거
    s = re.sub(r"throws\s+[A-Za-z0-9_.]+", "", s)

    # 제네릭 제거 <T>
    s = re.sub(r"<[^>]+>", "", s)

    # 타입 + 변수명 → 타입만 남기기
    # 예: "String input" → "String"
    s = re.sub(r"([A-Za-z0-9_.$\[\]]+)\s+[A-Za-z0-9_]+", r"\1", s)

    # 공백 정리
    s = re.sub(r"\s+", " ", s).strip()
    return s


def ui_anchor(class_name: str, sig: str) -> str:
    """사람이 보기 좋은 UI용 메서드 앵커

    Args:
        class_name: 클래스명 (FQCN 아님, 단순 클래스명)
        sig: 메서드 시그니처

    Returns:
        UI 앵커 (예: "Parser.parse(String)")

    예제:
        ui_anchor("Parser", "public static String parse(String input)")
        → "Parser.parse(String)"
    """
    sig_norm = normalize_ui_signature(sig)
    return f"{class_name}.{sig_norm}"
