# context/routes.py
from fastapi import APIRouter, HTTPException, Request, Depends, Query
from pydantic import BaseModel
from urllib.parse import quote
import os, json
from datetime import datetime
from .utils import (
    get_conn, read_text, write_text, split_md_sections, secret_scan,
    approx_tokens, count_tokens_model, _secret_count, safe_workspace_dir
)

router = APIRouter()

# ==== Pydantic ====
class PreviewReq(BaseModel):
    primary: list[int] = []
    reference: list[int] = []
    mask_secrets: bool = True
    snippet_chars: int = 120
    use_model_tokenizer: bool = False
    model: str | None = "gemini-2.0-flash"
    budget: int | None = None
    section_token_limit: int = 4000

class PrepareReq(BaseModel):
    primary: list[int] = []
    reference: list[int] = []
    mask: bool = True
    exclude_hashes: list[str] = []
    use_model_tokenizer: bool = False
    model: str | None = "gemini-2.0-flash"
    instruction: str = ""

# ==== /context/preview ====
@router.post("/preview")
def context_preview(req: PreviewReq, request: Request):
    state = request.app.state
    if not getattr(state, "workspace", None) or not getattr(state, "db_path", None):
        raise HTTPException(400, "workspace not set")
    conn = get_conn(state); cur = conn.cursor()
    ids = tuple(set(req.primary + req.reference)) or (-1,)
    q = f"SELECT id, path FROM files WHERE id IN ({','.join(['?']*len(ids))})"
    cur.execute(q, ids)
    id2path = {row[0]: row[1] for row in cur.fetchall()}
    conn.close()

    def rel(p):
        try: return os.path.relpath(p, state.workspace)
        except: return p

    use_tok = bool(req.use_model_tokenizer and req.model)
    sections = []

    def build_for(ids, role):
        for fid in ids:
            path = id2path.get(fid)
            if not path or not os.path.isfile(path): continue
            text = read_text(path)
            for s in split_md_sections(text):
                blob = f"# {s['title']}\n{s['content']}"
                masked = secret_scan(blob)
                masked = masked.get("masked") if isinstance(masked, dict) else masked
                view_blob = masked if req.mask_secrets else blob

                tok = count_tokens_model(view_blob, req.model or "gemini-2.0-flash") if use_tok else None
                tok = tok if tok is not None else approx_tokens(view_blob)
                sc = _secret_count(blob)

                warnings = []
                if sc > 0: warnings.append("secret")
                if tok >= (req.section_token_limit or 4000): warnings.append("long")

                sections.append({
                    "role": role, "file_id": fid, "file": rel(path),
                    "title": s["title"], "hash": s["hash"],
                    "token_guess": tok, "secret_count": sc,
                    "warnings": warnings, "snippet": (s["content"] or "")[:req.snippet_chars],
                })

    build_for(req.primary, "primary")
    build_for(req.reference, "reference")

    running = 0; budget = req.budget or 0
    for sec in sections:
        running += sec["token_guess"]
        sec["over_budget"] = bool(budget and running > budget)

    total_tokens = sum(s["token_guess"] for s in sections)
    return {
        "counts": {"primary_files": len(req.primary), "reference_files": len(req.reference), "sections": len(sections)},
        "total_token_guess": total_tokens,
        "sections": sections
    }

# ==== /context/prepare ====
@router.post("/prepare")
def context_prepare(req: PrepareReq, request: Request):
    state = request.app.state
    if not getattr(state, "workspace", None) or not getattr(state, "db_path", None):
        raise HTTPException(400, "workspace not set")

    conn = get_conn(state); cur = conn.cursor()
    ids = tuple(set(req.primary + req.reference)) or (-1,)
    q = f"SELECT id, path FROM files WHERE id IN ({','.join(['?']*len(ids))})"
    cur.execute(q, ids)
    id2path = {row[0]: row[1] for row in cur.fetchall()}
    conn.close()

    def rel(p):
        try: return os.path.relpath(p, state.workspace)
        except: return p

    order = []; packet_parts = []; ex = set(req.exclude_hashes or [])

    def expand(fid_list, role):
        for fid in fid_list:
            path = id2path.get(fid)
            if not path or not os.path.isfile(path): continue
            text = read_text(path)
            for s in split_md_sections(text):
                if s["hash"] in ex: continue
                order.append({"role": role, "file_id": fid, "file": rel(path), "title": s["title"], "hash": s["hash"], "token_guess": approx_tokens(f"# {s['title']}\n{s.get('content','')}")})
                packet_parts.append(f"## [{role}] {rel(path)} > {s['title']}\n\n{s.get('content', '')}\n")

    expand(req.primary, "primary"); expand(req.reference, "reference")
    instruction_block = f"## [instruction]\n\n{req.instruction.strip()}\n\n---\n\n" if req.instruction.strip() else ""
    raw_packet = instruction_block + "\n---\n".join(packet_parts)
    found = _secret_count(raw_packet)

    if req.mask:
        masked = secret_scan(raw_packet); packet = masked.get("masked") if isinstance(masked, dict) else masked; masked_applied = True
    else:
        packet = raw_packet; masked_applied = False

    # 총 토큰
    use_tok = bool(req.use_model_tokenizer and req.model)
    total_tokens = count_tokens_model(packet, req.model or "gemini-2.0-flash") if use_tok else None
    total_tokens = total_tokens if total_tokens is not None else approx_tokens(packet)

    out_dir = safe_workspace_dir(state, ".contextpanel", "packets")
    fname = f"context-{datetime.now().strftime('%Y%m%d-%H%M%S')}.txt"
    out_path = os.path.join(out_dir, fname); write_text(out_path, packet)

    return {
        "counts": {"primary_files": len(req.primary), "reference_files": len(req.reference), "sections": len(order), "secrets_found_est": found},
        "masked": masked_applied, "total_token_guess": total_tokens, "order": order,
        "preview": packet[:1000], "path": out_path, "download": "/export/file?path=" + quote(out_path)
    }

# ==== /recipes ====
class RecipeSaveReq(BaseModel):
    name: str
    primary_ids: list[int] = []
    reference_ids: list[int] = []
    primary_paths: list[str] = []
    reference_paths: list[str] = []
    exclude_hashes: list[str] = []
    mask: bool = True

def _recipes_dir(state) -> str:
    p = os.path.join(getattr(state, "workspace", ""), ".contextpanel", "recipes")
    os.makedirs(p, exist_ok=True); return p

def _sanitize_name(name: str) -> str:
    s = (name or "").strip().replace("\\", "/").split("/")[-1]
    if not s: raise HTTPException(400, "empty recipe name")
    return "".join(ch for ch in s if ch.isalnum() or ch in ("-", "_", ".", " "))

def _ids_to_paths(state, ids: list[int]) -> list[str]:
    if not ids: return []
    conn = get_conn(state); cur = conn.cursor()
    q = f"SELECT id, path FROM files WHERE id IN ({','.join(['?']*len(ids))})"
    cur.execute(q, tuple(ids))
    out = [row[1] for row in cur.fetchall()]
    conn.close(); return out

@router.post("/recipes/save")
def recipes_save(req: RecipeSaveReq, request: Request):
    state = request.app.state
    name = _sanitize_name(req.name)
    prim_paths = set(req.primary_paths) | set(_ids_to_paths(state, req.primary_ids))
    ref_paths  = set(req.reference_paths) | set(_ids_to_paths(state, req.reference_ids))
    data = {"name": name, "created_at": datetime.now().timestamp(),
            "primary_paths": sorted(prim_paths), "reference_paths": sorted(ref_paths),
            "exclude_hashes": list(dict.fromkeys(req.exclude_hashes or [])), "mask": bool(req.mask)}
    path = os.path.join(_recipes_dir(state), f"{name}.json"); write_text(path, json.dumps(data, ensure_ascii=False, indent=2))
    return {"ok": True, "file": path}

@router.get("/recipes")
def recipes_list(request: Request):
    state = request.app.state; p = _recipes_dir(state)
    items = []
    for f in sorted([*os.scandir(p)], key=lambda d: d.name):
        if not str(f.name).lower().endswith(".json"): continue
        try:
            j = json.loads(read_text(f.path))
            items.append({"name": j.get("name") or os.path.splitext(f.name)[0], "created_at": j.get("created_at"), "file": f.path})
        except: pass
    return items

@router.delete("/recipes/{name}")
def recipes_delete(name: str, request: Request):
    state = request.app.state
    path = os.path.join(_recipes_dir(state), f"{_sanitize_name(name)}.json")
    if not os.path.exists(path): raise HTTPException(404, "recipe not found")
    os.remove(path)
    return {"ok": True}

@router.get("/recipes/load")
def recipes_load(name: str, request: Request):
    state = request.app.state; path = os.path.join(_recipes_dir(state), f"{_sanitize_name(name)}.json")
    if not os.path.exists(path): raise HTTPException(404, "recipe not found")
    data = json.loads(read_text(path))
    conn = get_conn(state); cur = conn.cursor()
    cur.execute("SELECT id, path FROM files")
    path2id = {row[1]: row[0] for row in cur.fetchall()}
    conn.close()
    primary_ids   = [path2id[p] for p in data.get("primary_paths", []) if p in path2id]
    reference_ids = [path2id[p] for p in data.get("reference_paths", []) if p in path2id]
    return {"recipe": data, "resolve": {"primary_ids": primary_ids, "reference_ids": reference_ids}}

# ==== /export/report (컨텍스트 리포트) ====
class ExportReq(BaseModel):
    mask_secrets: bool = True

@router.post("/export/report")
def export_report(req: ExportReq, request: Request):
    state = request.app.state
    if not getattr(state, "workspace", None) or not getattr(state, "db_path", None):
        raise HTTPException(400, "workspace not set")
    conn = get_conn(state); cur = conn.cursor()
    cur.execute("SELECT id, path FROM files ORDER BY path")
    rows = cur.fetchall(); conn.close()
    parts = ["# Workspace Export\n"]
    for _fid, path in rows:
        try: txt = read_text(path)
        except: continue
        if req.mask_secrets: txt = secret_scan(txt)["masked"]
        rel = os.path.relpath(path, state.workspace)
        parts.append(f"## {rel}\n\n{txt}\n")
    out_dir = safe_workspace_dir(state, ".contextpanel", "exports")
    from datetime import datetime
    fname = f"report-{datetime.now().strftime('%Y%m%d-%H%M%S')}.md"
    out_path = os.path.join(out_dir, fname); write_text(out_path, "\n\n---\n\n".join(parts))
    return {"ok": True, "path": out_path, "download": f"/export/file?path={out_path}"}

# ==== MCP (API Key는 app.py에 남아있는 require_api_key를 그대로 써도 되고, 여기서 재구현해도 OK) ====
def _require_api_key(request: Request):
    state = request.app.state
    if not getattr(state, "api_key", None): raise HTTPException(400, "api key not initialized (set workspace first)")
    return state.api_key

@router.get("/mcp/manifest")
def mcp_manifest(request: Request, _=Depends(_require_api_key)):
    return {"name": "ContextPanel", "version": "0.1",
            "resources": [{"name":"files","path":"/context/mcp/files"},
                          {"name":"sections","path":"/context/mcp/sections?file_id={id}"},
                          {"name":"file","path":"/context/mcp/file?path={path}"},
                          {"name":"prepare_packet","path":"/context/mcp/prepare_packet"}],
            "notes": "Send X-API-Key header on all /context/mcp/* calls."}

@router.get("/mcp/files")
def mcp_files(request: Request, _=Depends(_require_api_key)):
    state = request.app.state; conn = get_conn(state); cur = conn.cursor()
    cur.execute("SELECT id, path FROM files ORDER BY path")
    rows = [{"id": r[0], "path": r[1]} for r in cur.fetchall()]
    conn.close(); return rows

@router.get("/mcp/sections")
def mcp_sections(file_id: int, request: Request, _=Depends(_require_api_key)):
    state = request.app.state; conn = get_conn(state); cur = conn.cursor()
    cur.execute("SELECT title, hash, token_guess FROM sections WHERE file_id=? ORDER BY id", (file_id,))
    rows = [{"title": r[0], "hash": r[1], "token_guess": r[2]} for r in cur.fetchall()]
    conn.close(); return rows

@router.get("/mcp/file")
def mcp_file(path: str, request: Request, _=Depends(_require_api_key)):
    state = request.app.state
    if not os.path.isabs(path) and getattr(state, "workspace", None):
        path = os.path.join(state.workspace, path)
    if not os.path.isfile(path): raise HTTPException(404, "file not found")
    txt = read_text(path)
    from .utils import sha256 as _sha
    return {"path": path, "content": txt, "hash": _sha(txt), "mtime": os.path.getmtime(path)}

@router.post("/mcp/prepare_packet")
def mcp_prepare_packet(req: PrepareReq, request: Request, _=Depends(_require_api_key)):
    return context_prepare(req, request)