# context/utils.py
import os, re, sqlite3, json
from pathlib import Path
from fastapi import HTTPException

# ---- 토큰/시크릿/텍스트 ----
def sha256(text: str):
    import hashlib
    return hashlib.sha256(text.encode('utf-8')).hexdigest()

def count_tokens_model(text: str, model_name: str) -> int | None:
    try:
        import google.generativeai as genai, os
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key: return None
        genai.configure(api_key=api_key)
        m = genai.GenerativeModel(model_name)
        res = m.count_tokens(text)
        return int(getattr(res, "total_tokens", res.get("total_tokens")))
    except Exception:
        return None

def approx_tokens(text: str) -> int:
    import re
    return int(len(re.findall(r"\S+", text)) * 1.3)

_SK = re.compile(r'\bsk-[A-Za-z0-9_-]{8,}\b')
_AKIA = re.compile(r'\bAKIA[0-9A-Z]{16}\b')
_BEARER = re.compile(r'\bBearer\s+[A-Za-z0-9\-\._~+\/]+=*\b')
_GENERIC = re.compile(r'(?i)\b(key|token|secret|api_key)\s*[:=]\s*[\'"]?([A-Za-z0-9_\-]{8,})[\'"]?')

def _secret_count(text: str) -> int:
    return sum(len(p.findall(text)) for p in (_SK, _AKIA, _BEARER, _GENERIC))

def secret_scan(text: str) -> dict:
    def _mask_middle(s: str, keep=3):
        return s if len(s) <= keep*2 else s[:keep] + "*"*(len(s)-keep*2) + s[-keep:]
    masked = re.sub(r'\bsk-([A-Za-z0-9_-]{8,})\b', lambda m: "sk-"+_mask_middle(m.group(1)), text)
    masked = _AKIA.sub('AKIA' + '*'*16, masked)
    masked = _BEARER.sub('Bearer ***MASKED***', masked)
    masked = _GENERIC.sub(lambda m: f"{m.group(1)}=***MASKED***", masked)
    return {"masked": masked}

def split_md_sections(text: str) -> list[dict]:
    sections = []; lines = text.split('\n')
    current_title = "Introduction"; current_content = []
    for line in lines:
        m = re.match(r'^(#+)\s+(.*)', line)
        if m:
            if current_content:
                content_str = '\n'.join(current_content).strip()
                if content_str:
                    content_only = '\n'.join(current_content[1:]).strip() if len(current_content) > 1 else ""
                    sections.append({"title": current_title, "content": content_only, "hash": sha256(content_str), "token_guess": approx_tokens(content_str)})
            current_title = m.group(2); current_content = [line]
        else:
            current_content.append(line)
    if current_content:
        content_str = '\n'.join(current_content).strip()
        if content_str:
            content_only = '\n'.join(current_content[1:]).strip() if len(current_content) > 1 else ""
            sections.append({"title": current_title, "content": content_only, "hash": sha256(content_str), "token_guess": approx_tokens(content_str)})
    return sections

def read_text(path: str) -> str:
    """스마트 텍스트 읽기 - UTF-8, CP949, EUC-KR 순서로 시도"""
    p = Path(path)
    b = p.read_bytes()
    for enc in ("utf-8", "cp949", "euc-kr", "latin-1"):
        try: 
            return b.decode(enc)
        except UnicodeDecodeError: 
            pass
    return b.decode("utf-8", "replace")

def write_text(path: str, text: str):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(text, encoding="utf-8")

# ---- DB/경로 유틸 ----
def get_conn(state):
    db = getattr(state, "db_path", None)
    if not db: raise RuntimeError("DB not initialized")
    return sqlite3.connect(db)

def safe_workspace_dir(state, *parts) -> str:
    ws = getattr(state, "workspace", None)
    if not ws: raise HTTPException(400, "workspace not set")
    p = Path(ws).joinpath(*parts)
    p.parent.mkdir(parents=True, exist_ok=True)
    return str(p)