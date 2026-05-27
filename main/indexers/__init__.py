from pathlib import Path
from typing import Dict, Any, Optional
from .base import IndexerBase

_registry: Dict[str, IndexerBase] = {}


def register(indexer: IndexerBase) -> None:
    for ext in indexer.extensions:
        _registry[ext] = indexer


def for_file(path: Path) -> Optional[IndexerBase]:
    """파일 확장자로 적합한 인덱서 반환. 미지원 언어면 None."""
    return _registry.get(path.suffix.lower())


def all_extensions() -> set:
    """등록된 모든 확장자 집합. 예: {'.java', '.py'}"""
    return set(_registry.keys())


def index_workspace(workspace: Path) -> Dict[str, Any]:
    """
    워크스페이스에서 지원 언어를 자동 감지해 인덱싱.
    여러 언어가 섞인 경우 첫 번째 발견 언어 사용 (추후 merge 확장 가능).
    """
    found_ext = None
    for p in workspace.rglob("*"):
        if p.suffix.lower() in _registry:
            found_ext = p.suffix.lower()
            break

    if not found_ext:
        return {"packages": [], "relations": []}

    return _registry[found_ext].index_workspace(workspace)


# 빌트인 인덱서 등록
from .java import JavaIndexer
register(JavaIndexer())
