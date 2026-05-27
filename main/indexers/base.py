from abc import ABC, abstractmethod
from pathlib import Path
from typing import Dict, Any, List


class IndexerBase(ABC):

    @property
    @abstractmethod
    def extensions(self) -> List[str]:
        """처리하는 파일 확장자. 예: ['.java']"""
        ...

    @property
    def exclude_dirs(self) -> List[str]:
        return ["build", "out", "bin", "target", ".git", "node_modules", "__pycache__"]

    @abstractmethod
    def index_workspace(self, workspace: Path) -> Dict[str, Any]:
        """
        워크스페이스 전체 인덱싱.
        반환: {"packages": [...], "relations": [...]}
        패키지/모듈 → 클래스/컨테이너 → 메서드/함수 계층 구조.
        """
        ...

    @abstractmethod
    def get_namespace(self, content: str, file_path: Path, workspace: Path) -> str:
        """
        파일의 네임스페이스 추출.
        Java: 'package com.example;' → 'com.example'
        Python: 파일 경로 기반 → 'myapp.service'
        """
        ...

    @abstractmethod
    def get_units(self, content: str) -> List[Dict[str, Any]]:
        """
        파일 내 최상위 구조 단위 목록. graph_utils 용.
        반환: [{"name": str, "start_byte": int, "kind": str}, ...]
        """
        ...

    @abstractmethod
    def parse_file_members(self, content: str, file_path: Path, workspace: Path) -> List[Dict[str, Any]]:
        """
        파일 내 모든 멤버(메서드/함수) 파싱. compare_utils 용.
        반환: [{"id": str, "range": {"start": [line, col], "end": [line, col]}, "loc": int}, ...]
        """
        ...
