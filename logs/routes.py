# logs/routes.py
from fastapi import APIRouter
router = APIRouter()

@router.get("/list")
def list_logs(branch: str = "main"):
    return []

@router.post("/add")
def add_log(item: dict):
    return {"ok": True, "id": 1}

@router.get("/get")
def get_log(id: int):
    return {"id": id, "type": "change", "title": "stub"}