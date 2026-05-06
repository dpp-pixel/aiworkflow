# main/anchor_utils/ui_anchor.py
"""UI용 앵커 - 사람이 보기 좋은 정갈한 표시"""
import re

def normalize_ui_signature(sig: str) -> str:
    """UI 표시용 시그니처 정규화 → 'methodName(Type, Type)'

    예: "public static String parse(String input)"
    → "parse(String)"
    """
    s = re.sub(r"\b(public|private|protected|static|final|abstract|synchronized|native|default|strictfp)\b", "", sig)
    s = re.sub(r"@\w+(\([^)]*\))?\s*", "", s)
    s = re.sub(r"\s*throws\s+[\w\s,$.]+", "", s)
    s = re.sub(r"<[^>]+>", "", s)

    # returnType methodName(params) 형태에서 methodName + params만 추출
    match = re.match(r"\s*[\w\[\].$]+\s+([\w$]+)\s*\(([^)]*)\)", s.strip())
    if not match:
        return re.sub(r"\s+", " ", s).strip()

    method_name = match.group(1).strip()
    params = match.group(2).strip()

    if params:
        param_list = [p.strip().split()[0] for p in params.split(",") if p.strip()]
        params = ", ".join(param_list)

    return f"{method_name}({params})"


def ui_anchor(class_name: str, sig: str) -> str:
    """사람이 보기 좋은 UI용 메서드 앵커

    예: ui_anchor("Parser", "public static String parse(String input)")
    → "Parser.parse(String)"
    """
    return f"{class_name}.{normalize_ui_signature(sig)}"
