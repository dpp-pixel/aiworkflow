import os
import glob
import sqlite3
import hashlib
import re
import time
import difflib
import secrets
import json
from datetime import datetime
from time import time as now
from urllib.parse import quote
from typing import List
from pydantic import BaseModel
from fastapi import FastAPI, HTTPException, Query, Depends, Header, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pathlib import Path
import sys
from fastapi.staticfiles import StaticFiles
from starlette.responses import RedirectResponse

# Router imports
from context.routes import router as context_router
from main.routes import router as main_router
from logs.routes import router as logs_router

# ---- Helper Functions ----


def require_api_key(x_api_key: str | None = Header(None)):
    if not getattr(app.state, "api_key", None):
        raise HTTPException(400, "api key not initialized (set workspace first)")
    if x_api_key != app.state.api_key:
        raise HTTPException(401, "invalid api key")


def file_sha(path: str) -> str:
    try:
        import hashlib
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            text = f.read()
        return hashlib.sha256(text.encode('utf-8')).hexdigest()
    except Exception:
        return ""

def reindex_single_file(path: str):
    if not getattr(app.state, "workspace", None) or not getattr(app.state, "db_path", None):
        return
    if not os.path.isfile(path):
        return
    # 컨텍스트 유틸 임포트
    from context.utils import read_text, sha256, split_md_sections
    
    conn = get_conn()
    cur = conn.cursor()
    text = read_text(path)
    h = sha256(text)
    st = os.stat(path)
    cur.execute("SELECT id FROM files WHERE path=?", (path,))
    row = cur.fetchone()
    if row:
        fid = row[0]
        cur.execute("UPDATE files SET hash=?, size=?, mtime=? WHERE id=?", (h, st.st_size, st.st_mtime, fid))
        cur.execute("DELETE FROM sections WHERE file_id=?", (fid,))
    else:
        cur.execute("INSERT INTO files(path, hash, size, mtime) VALUES (?,?,?,?)",
                    (path, h, st.st_size, st.st_mtime))
        fid = cur.lastrowid
    for s in split_md_sections(text):
        cur.execute("INSERT INTO sections(file_id, title, hash, token_guess) VALUES (?,?,?,?)",
                    (fid, s["title"], s["hash"], s["token_guess"]))
    conn.commit()
    conn.close()

# === 워크스페이스 경로 보안 + 유틸 ===
def _safe_workspace_path(name: str) -> Path:
    if not getattr(app.state, "workspace", None):
        raise HTTPException(400, "workspace not set")
    base = Path(app.state.workspace).resolve()
    # 역슬래시를 슬래시로 정규화 후 상대경로 처리
    name = (name or "").strip().replace("\\", "/")
    if not name:
        raise HTTPException(400, "empty name")
    p = (base / name).resolve()
    # 워크스페이스 밖으로 나가는 것 방지
    if base not in p.parents and p != base:
        raise HTTPException(400, "invalid path (outside workspace)")
    return p

def _unique_path(p: Path) -> Path:
    if not p.exists():
        return p
    i = 1
    stem, suffix = p.stem, p.suffix
    while True:
        cand = p.with_name(f"{stem}_{i}{suffix}")
        if not cand.exists():
            return cand
        i += 1


# ==== 설정 파일 경로/IO ====
def _user_config_dir() -> Path:
    if os.name == "nt":
        base = os.environ.get("APPDATA") or (Path.home() / "AppData" / "Roaming")
        return Path(base) / "ContextPanel"
    else:
        return Path.home() / ".contextpanel"

def _cfg_path() -> Path:
    d = _user_config_dir()
    d.mkdir(parents=True, exist_ok=True)
    return d / "config.json"

_DEFAULT_CFG = {
    "last_workspace": None,
    "default_mask": True,
    "auto_scan": True,
    "persist_mcp_key": True,  # 원하면 False로 바꿔도 됨
    "api_key": None,          # persist_mcp_key가 True일 때만 저장
    "ui": {"theme": "light"}
}

def load_cfg() -> dict:
    p = _cfg_path()
    if not p.exists():
        return _DEFAULT_CFG.copy()
    try:
        return {**_DEFAULT_CFG, **json.loads(p.read_text(encoding="utf-8"))}
    except Exception:
        return _DEFAULT_CFG.copy()

def save_cfg(cfg: dict):
    _cfg_path().write_text(json.dumps(cfg, ensure_ascii=False, indent=2), encoding="utf-8")

# ---- App Setup ----
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],  # SSE에 필요한 헤더 노출
)

BASE_DIR = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))
FRONTEND_DIR = BASE_DIR / "frontend"

# Development: Vite dev server at :3000
# Production: Built files in frontend/dist
if (FRONTEND_DIR / "dist").exists():
    app.mount("/ui", StaticFiles(directory=str(FRONTEND_DIR / "dist"), html=True), name="ui")
else:
    # Development mode - redirect to Vite dev server
    @app.get("/ui/{path:path}")
    def dev_frontend(path: str = ""):
        from starlette.responses import RedirectResponse
        return RedirectResponse(url=f"http://localhost:5173/{path}")

# Include routers
app.include_router(context_router, prefix="/context", tags=["context"])
app.include_router(main_router, prefix="/main", tags=["main"])
app.include_router(logs_router, prefix="/logs", tags=["logs"])

@app.get("/")
def root():
    # / → /ui/ 로 안내 (정적앱 진입점)
    return RedirectResponse(url="/ui/")

app.state.workspace = None
app.state.db_path = None
app.state.current_checkpoint = None

@app.on_event("startup")
async def restore_last_workspace():
    """서버 재시작 시 마지막 워크스페이스 자동 복원"""
    cfg = load_cfg()
    last = cfg.get("last_workspace")
    if last and os.path.isdir(last):
        app.state.workspace = last
        app.state.db_path = os.path.join(last, ".contextpanel", "context.db")
        if cfg.get("persist_mcp_key") and cfg.get("api_key"):
            app.state.api_key = cfg["api_key"]
        else:
            app.state.api_key = secrets.token_urlsafe(24)
        init_db(app.state.db_path)

def init_db(db_path: str):
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS files(
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          path TEXT UNIQUE,
          hash TEXT,
          size INTEGER,
          mtime REAL
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS sections(
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          file_id INTEGER,
          title TEXT,
          hash TEXT,
          token_guess INTEGER,
          FOREIGN KEY(file_id) REFERENCES files(id) ON DELETE CASCADE
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS checkpoints(
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          path TEXT,
          created_at REAL,
          hash TEXT,
          content TEXT
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS logs(
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          type TEXT,
          title TEXT,
          details TEXT,
          ts REAL,
          branch TEXT,
          cp_id INTEGER,
          packet_path TEXT
        )
    """)
    conn.commit()
    conn.close()

def get_conn():
    if not app.state.db_path:
        raise RuntimeError("DB not initialized")
    return sqlite3.connect(app.state.db_path)

# ---- Pydantic Models ----
class WorkspaceReq(BaseModel):
    path: str

class SaveReq(BaseModel):
    path: str
    content: str
    expected_hash: str | None = None
    reindex: bool = True

class ExportReq(BaseModel):
    mask_secrets: bool = True

class CPCreateReq(BaseModel):
    path: str

class CPRestoreReq(BaseModel):
    id: int
    path: str


class NewFileReq(BaseModel):
    name: str
    content: str = ""

class LogAddReq(BaseModel):
    type: str
    title: str
    details: str | None = None
    branch: str = "main"
    cp_id: int | None = None
    packet_path: str | None = None


class SettingsUpdate(BaseModel):
    default_mask: bool | None = None
    auto_scan: bool | None = None
    persist_mcp_key: bool | None = None
    ui: dict | None = None

# ---- Routes ----
@app.get("/healthz")
def healthz():
    return {"ok": True}

# === 설정 가져오기/저장 API ===
@app.get("/settings")
def get_settings():
    cfg = load_cfg()
    # 실행 중 API 키가 있으면(워크스페이스 설정 시 생성됨) 보여줌
    if getattr(app.state, "api_key", None):
        cfg["api_key"] = app.state.api_key if cfg.get("persist_mcp_key") else None
    return cfg

@app.post("/settings")
def update_settings(body: SettingsUpdate):
    cfg = load_cfg()
    for k, v in body.dict(exclude_none=True).items():
        cfg[k] = v
    # persist_mcp_key가 False면 저장본의 api_key는 null 처리
    if cfg.get("persist_mcp_key") is False:
        cfg["api_key"] = None
    else:
        # 현재 세션 키를 저장(있을 때만)
        if getattr(app.state, "api_key", None):
            cfg["api_key"] = app.state.api_key
    save_cfg(cfg)
    return {"ok": True, "settings": cfg}

@app.get("/workspace/browse")
def browse_directory(path: str = ""):
    if not path:
        path = os.path.expanduser("~")
    path = os.path.abspath(path)
    if not os.path.isdir(path):
        raise HTTPException(400, "Not a directory")

    items = []
    try:
        for entry in sorted(os.scandir(path), key=lambda e: (not e.is_dir(), e.name.lower())):
            if entry.is_dir() and not entry.name.startswith('.'):
                items.append({"name": entry.name, "path": entry.path})
    except PermissionError:
        pass

    p = Path(path)
    parent = str(p.parent) if p != p.parent else None
    # Windows 드라이브 루트일 때 drives 목록 제공
    drives = []
    if parent is None:
        import string
        drives = [f"{d}:\\" for d in string.ascii_uppercase if os.path.exists(f"{d}:\\")]
    return {"path": path, "parent": parent, "items": items, "drives": drives}

@app.post("/workspace/set")
def set_workspace(req: WorkspaceReq):
    if not os.path.isdir(req.path):
        raise HTTPException(400, "Not a folder")
    app.state.workspace = os.path.abspath(req.path)
    app.state.db_path = os.path.join(app.state.workspace, ".contextpanel", "context.db")
    if not getattr(app.state, "api_key", None):
        app.state.api_key = secrets.token_urlsafe(24)
    init_db(app.state.db_path)
    
    # 설정 저장
    cfg = load_cfg()
    cfg["last_workspace"] = app.state.workspace
    if cfg.get("persist_mcp_key"):   # 세션 키를 저장
        cfg["api_key"] = getattr(app.state, "api_key", None)
    save_cfg(cfg)
    
    return {"workspace": app.state.workspace, "db": app.state.db_path, "api_key": app.state.api_key}

@app.post("/workspace/scan")
def scan_workspace():
    if not getattr(app.state, "workspace", None):
        raise HTTPException(400, "workspace not set")
    # 컨텍스트 유틸 임포트
    from context.utils import sha256, split_md_sections
    
    md_files = glob.glob(os.path.join(app.state.workspace, "**", "*.md"), recursive=True)
    inserted = updated = 0
    conn = get_conn()
    cur = conn.cursor()
    for path in md_files:
        try:
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                text = f.read()
        except Exception:
            continue
        h = sha256(text)
        st = os.stat(path)
        cur.execute("SELECT id, hash FROM files WHERE path=?", (path,))
        row = cur.fetchone()
        if not row:
            cur.execute(
                "INSERT INTO files(path, hash, size, mtime) VALUES (?,?,?,?)",
                (path, h, st.st_size, st.st_mtime)
            )
            file_id = cur.lastrowid
            inserted += 1
        else:
            file_id, old_h = row
            if old_h != h:
                cur.execute(
                    "UPDATE files SET hash=?, size=?, mtime=? WHERE id=?",
                    (h, st.st_size, st.st_mtime, file_id)
                )
                cur.execute("DELETE FROM sections WHERE file_id=?", (file_id,))
                updated += 1
            else:
                continue
        for s in split_md_sections(text):
            cur.execute(
                "INSERT INTO sections(file_id, title, hash, token_guess) VALUES (?,?,?,?)",
                (file_id, s["title"], s["hash"], s["token_guess"])
            )
    conn.commit()
    conn.close()
    return {"files": len(md_files), "inserted": inserted, "updated": updated}

@app.get("/files")
def list_files():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT id, path FROM files ORDER BY path")
    rows = [{"id": r[0], "path": r[1]} for r in cur.fetchall()]
    conn.close()
    return rows

@app.get("/files/{file_id}/sections")
def list_sections(file_id: int):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT title, hash, token_guess FROM sections WHERE file_id=? ORDER BY id", (file_id,))
    rows = [{"title": r[0], "hash": r[1], "token_guess": r[2]} for r in cur.fetchall()]
    conn.close()
    return rows

# === 새 파일 만들기 ===
@app.post("/files/new")
def files_new(req: NewFileReq):
    from context.utils import write_text
    # .md 강제
    name = req.name.strip()
    if not name.lower().endswith(".md"):
        name += ".md"
    dest = _safe_workspace_path(name)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest = _unique_path(dest)
    write_text(str(dest), req.content)
    try: reindex_single_file(str(dest))
    except: pass
    rel = os.path.relpath(dest, app.state.workspace)
    return {"ok": True, "path": str(dest), "relative": rel}

# === 파일 가져오기(여러 개) ===
@app.post("/files/import")
async def files_import(
    subdir: str = Form(default=""),
    files: List[UploadFile] = File(...)
):
    from context.utils import write_text
    if not files:
        raise HTTPException(400, "no files")
    saved = []
    for f in files:
        # .md만 수용 (원하면 조건 제거)
        if not f.filename.lower().endswith(".md"):
            continue
        name = os.path.join(subdir.strip(), os.path.basename(f.filename))
        dest = _safe_workspace_path(name)
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest = _unique_path(dest)
        data = await f.read()
        try:
            text = data.decode("utf-8")
        except Exception:
            text = data.decode("utf-8", "ignore")
        write_text(str(dest), text)
        try: reindex_single_file(str(dest))
        except: pass
        saved.append(str(dest))
    return {"ok": True, "count": len(saved), "saved": saved}


@app.get("/file")
def get_file(path: str = Query(..., description="절대경로 또는 워크스페이스 하위 경로")):
    from context.utils import read_text, sha256
    if not os.path.isabs(path) and getattr(app.state, "workspace", None):
        path = os.path.join(app.state.workspace, path)
    if not os.path.isfile(path):
        raise HTTPException(404, "file not found")
    txt = read_text(path)
    return {
        "path": path,
        "content": txt,
        "hash": sha256(txt),
        "mtime": os.path.getmtime(path)
    }

@app.post("/file/save")
def save_file(req: SaveReq):
    from context.utils import read_text, write_text, sha256
    path = req.path
    if not os.path.isabs(path) and getattr(app.state, "workspace", None):
        path = os.path.join(app.state.workspace, path)
    current_hash = file_sha(path) if os.path.exists(path) else None
    if req.expected_hash and current_hash and req.expected_hash != current_hash:
        old = read_text(path)
        diff = "\n".join(difflib.unified_diff(
            old.splitlines(), req.content.splitlines(),
            fromfile="disk", tofile="yours", lineterm=""
        ))
        raise HTTPException(status_code=409, detail={"conflict": True, "diff": diff, "current_hash": current_hash})
    write_text(path, req.content)
    if req.reindex:
        reindex_single_file(path)
    return {"ok": True, "hash": sha256(req.content), "mtime": os.path.getmtime(path)}


@app.get("/export/file")
def export_file(path: str):
    if not os.path.isfile(path):
        raise HTTPException(404, "not found")
    return FileResponse(path, media_type="text/markdown", filename=os.path.basename(path))

@app.post("/checkpoint/create")
def checkpoint_create(req: CPCreateReq):
    from context.utils import read_text, sha256
    if not os.path.isabs(req.path) and getattr(app.state, "workspace", None):
        req.path = os.path.join(app.state.workspace, req.path)
    if not os.path.isfile(req.path):
        raise HTTPException(404, "file not found")
    txt = read_text(req.path)
    h = sha256(txt)
    conn = get_conn(); cur = conn.cursor()
    cur.execute("INSERT INTO checkpoints(path, created_at, hash, content) VALUES (?,?,?,?)",
                (req.path, now(), h, txt))
    conn.commit(); cid = cur.lastrowid; conn.close()
    return {"ok": True, "id": cid, "hash": h}

@app.get("/checkpoint/list")
def checkpoint_list(path: str = Query(...)):
    if not os.path.isabs(path) and getattr(app.state, "workspace", None):
        path = os.path.join(app.state.workspace, path)
    conn = get_conn(); cur = conn.cursor()
    cur.execute("SELECT id, created_at, hash FROM checkpoints WHERE path=? ORDER BY id DESC", (path,))
    rows = [{"id": r[0], "created_at": r[1], "hash": r[2]} for r in cur.fetchall()]
    conn.close()
    return rows

@app.get("/checkpoint/diff")
def checkpoint_diff(path: str = Query(...), id: int = Query(...)):
    from context.utils import read_text
    if not os.path.isabs(path) and getattr(app.state, "workspace", None):
        path = os.path.join(app.state.workspace, path)
    conn = get_conn(); cur = conn.cursor()
    cur.execute("SELECT content FROM checkpoints WHERE id=? AND path=?", (id, path))
    row = cur.fetchone(); conn.close()
    if not row: raise HTTPException(404, "checkpoint not found")
    old = row[0]
    curtxt = read_text(path) if os.path.exists(path) else ""
    diff = "\n".join(difflib.unified_diff(
        old.splitlines(), curtxt.splitlines(),
        fromfile=f"cp:{id}", tofile="disk", lineterm=""
    ))
    return {"diff": diff}

@app.post("/checkpoint/restore")
def checkpoint_restore(req: CPRestoreReq):
    from context.utils import write_text, sha256
    path = req.path
    if not os.path.isabs(path) and getattr(app.state, "workspace", None):
        path = os.path.join(app.state.workspace, path)
    conn = get_conn(); cur = conn.cursor()
    cur.execute("SELECT content FROM checkpoints WHERE id=? AND path=?", (req.id, path))
    row = cur.fetchone(); conn.close()
    if not row: raise HTTPException(404, "checkpoint not found")
    write_text(path, row[0])
    # 저장 후 인덱싱 갱신
    try: reindex_single_file(path)
    except: pass
    return {"ok": True, "hash": sha256(row[0])}


# ---- Log Routes ----
@app.get("/log/list")
def log_list(branch: str = "main"):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT id, type, title, details, ts, branch, cp_id, packet_path FROM logs WHERE branch = ? ORDER BY ts DESC", (branch,))
    rows = cur.fetchall()
    conn.close()
    
    return [
        {
            "id": row[0],
            "type": row[1],
            "title": row[2],
            "details": row[3],
            "ts": row[4],
            "branch": row[5],
            "cp_id": row[6],
            "packet_path": row[7]
        }
        for row in rows
    ]

@app.get("/log/get")
def log_get(id: int):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT id, type, title, details, ts, branch, cp_id, packet_path FROM logs WHERE id = ?", (id,))
    row = cur.fetchone()
    conn.close()
    
    if not row:
        raise HTTPException(404, "log entry not found")
    
    return {
        "id": row[0],
        "type": row[1],
        "title": row[2],
        "details": row[3],
        "ts": row[4],
        "branch": row[5],
        "cp_id": row[6],
        "packet_path": row[7]
    }

@app.post("/log/add")
def log_add(req: LogAddReq):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO logs (type, title, details, ts, branch, cp_id, packet_path)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (req.type, req.title, req.details, now(), req.branch, req.cp_id, req.packet_path))
    log_id = cur.lastrowid
    conn.commit()
    conn.close()
    
    return {"ok": True, "id": log_id}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)