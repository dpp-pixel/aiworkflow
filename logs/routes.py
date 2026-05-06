# logs/routes.py
from fastapi import APIRouter, HTTPException, Request
from typing import Optional
import json, time
from main.checkpoint_utils import list_checkpoints

router = APIRouter()


def _ckpt_ts(ckpt: dict) -> float:
    """체크포인트 ISO 시간 → Unix timestamp"""
    try:
        from datetime import datetime, timezone
        return datetime.fromisoformat(ckpt["createdAt"].replace("Z", "+00:00")).timestamp()
    except Exception:
        return 0.0


def _build_tree(checkpoints: list) -> list:
    by_id = {c["id"]: {**c, "children": []} for c in checkpoints}
    roots = []
    for c in checkpoints:
        pid = c.get("parentId")
        if pid and pid in by_id:
            by_id[pid]["children"].append(by_id[c["id"]])
        else:
            roots.append(by_id[c["id"]])

    def sort_node(node):
        node["children"].sort(key=lambda x: x["createdAt"])
        for child in node["children"]:
            sort_node(child)

    roots.sort(key=lambda x: x["createdAt"])
    for r in roots:
        sort_node(r)
    return roots


def _get_file_events(limit: int = 200) -> list:
    """file_changed 로그 조회"""
    try:
        from logs.utils import get_conn
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("""
            SELECT id, type, title, details, ts
            FROM logs
            WHERE type = 'file_changed'
            ORDER BY ts DESC
            LIMIT ?
        """, (limit,))
        rows = cur.fetchall()
        conn.close()
        result = []
        for row in rows:
            details = {}
            try:
                details = json.loads(row[3]) if row[3] else {}
            except Exception:
                pass
            result.append({
                "entryType": "file_event",
                "id": row[0],
                "title": row[2],
                "path": details.get("path", ""),
                "kind": details.get("kind", "modified"),
                "diff": details.get("diff"),
                "ts": row[4]
            })
        return result
    except Exception as e:
        print(f"[logs] file_events error: {e}")
        return []


@router.get("/checkpoints")
def get_checkpoints(projectId: Optional[str] = None):
    """체크포인트 목록 (parentId 포함)"""
    try:
        return {"items": list_checkpoints(projectId)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/checkpoints/tree")
def get_checkpoints_tree(projectId: Optional[str] = None, request: Request = None):
    """체크포인트 트리 구조 + 현재 활성 체크포인트"""
    try:
        items = list_checkpoints(projectId)
        current = getattr(request.app.state, "current_checkpoint", None) if request else None
        return {"tree": _build_tree(items), "current": current}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/timeline")
def get_timeline(projectId: Optional[str] = None, request: Request = None):
    """체크포인트 + 파일 변경 이벤트 통합 타임라인 (최신순)"""
    try:
        ckpts = list_checkpoints(projectId)
        ckpt_entries = [
            {**c, "entryType": "checkpoint", "ts": _ckpt_ts(c)}
            for c in ckpts
        ]
        file_events = _get_file_events()
        timeline = sorted(ckpt_entries + file_events, key=lambda x: x.get("ts", 0), reverse=True)
        current = getattr(request.app.state, "current_checkpoint", None) if request else None
        return {"timeline": timeline, "current": current}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
