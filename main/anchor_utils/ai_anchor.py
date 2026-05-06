# main/anchor_utils/ai_anchor.py
"""AI용 앵커 - 내부 시스템/AI 작업에서 사용하는 고정된 식별자"""
import re

def normalize_ai_signature(sig: str) -> str:
    """AI/시스템 내부용 시그니처 정규화 → 'methodName(Type,Type)' (compact)

    예: "public static String parse(String input)"
    → "parse(String)"
    """
    s = re.sub(r"\b(public|private|protected|static|final|abstract|synchronized|native|default|strictfp)\b", "", sig)
    s = re.sub(r"@\w+(\([^)]*\))?\s*", "", s)
    s = re.sub(r"\s*throws\s+[\w\s,$.]+", "", s)
    s = re.sub(r"<[^>]+>", "", s)

    match = re.match(r"\s*[\w\[\].$]+\s+([\w$]+)\s*\(([^)]*)\)", s.strip())
    if not match:
        return re.sub(r"\s+", " ", s).strip()

    method_name = match.group(1).strip()
    params = match.group(2).strip()

    if params:
        param_list = [p.strip().split()[0] for p in params.split(",") if p.strip()]
        params = ",".join(param_list)

    return f"{method_name}({params})"


def ai_anchor(pkg: str, class_name: str, sig: str) -> str:
    """AI/시스템 내부에서 사용하는 고정된 식별자 앵커

    예: ai_anchor("com.example", "Parser", "public static String parse(String input)")
    → "m:com.example.Parser.parse(String)"
    """
    sig_norm = normalize_ai_signature(sig)
    fqcn = f"{pkg}.{class_name}" if pkg else class_name
    return f"m:{fqcn}.{sig_norm}"
