# main/snippets.py
from __future__ import annotations
from pathlib import Path
from typing import List, Dict, Any, Tuple
import hashlib

from .utils import WORKSPACE
from .compare_utils import load_state_files, index_filemap  # 재사용

def _sha(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8", "ignore")).hexdigest()

def _slice_with_context(lines: List[str], start_line: int, end_line: int, ctx: int) -> Tuple[int,int,str]:
    """라인 배열에서 컨텍스트와 함께 슬라이스 추출
    
    Args:
        lines: 파일의 라인들
        start_line: 시작 라인 (0-based)
        end_line: 끝 라인 (0-based)
        ctx: 앞뒤로 포함할 컨텍스트 라인 수
        
    Returns:
        (actual_start_line, actual_end_line, text)
    """
    n = len(lines)
    s = max(0, start_line - ctx)
    e = min(n - 1, end_line + ctx)
    text = "\n".join(lines[s:e+1])
    return s, e, text

def build_snippet_pack(
    project_id: str,
    anchors: List[str],
    context_lines: int = 3,
    baseline: str = "working",
    scope: List[str] | None = None
) -> Dict[str, Any]:
    """
    특정 앵커들에 해당하는 코드 스니펫 팩 빌드
    
    Args:
        project_id: 프로젝트 ID
        anchors: 추출할 앵커들 (예: ["m:com.example.Parser.parseTokens(String)"])
        context_lines: 앞뒤로 포함할 컨텍스트 라인 수
        baseline: 소스 상태 ("working", "ckpt_xxx", "dir:/path")
        scope: 파일 스코프 필터 (예: ["src/**"])
    
    Returns:
        SnippetPack: {
            "projectId": str,
            "baseline": str,
            "items": [
                {
                    "anchor": str,
                    "file": str,
                    "range": {"start": [line, col], "end": [line, col]},
                    "hash": str,
                    "text": str
                }
            ],
            "missing": [str]  # 찾지 못한 앵커들
        }
    """
    files = load_state_files(baseline, scope)
    idx = index_filemap(files)  # {anchors:{id->{file,range,hash,loc}}, reverse:...}
    
    hit_items = []
    missing = []
    
    for a in anchors:
        meta = idx["anchors"].get(a)
        if not meta:
            missing.append(a)
            continue
            
        file = meta["file"]
        rng = meta["range"]
        
        # 파일이 로드된 파일 목록에 있는지 확인
        if file not in files:
            missing.append(a)
            continue
            
        lines = files[file].splitlines()
        
        # 컨텍스트와 함께 슬라이스 추출
        s0, e0, text = _slice_with_context(
            lines, 
            rng["start"][0], 
            rng["end"][0], 
            context_lines
        )
        
        # 실제 범위 정보 (컨텍스트 포함)
        item = {
            "anchor": a,
            "file": file,
            "range": {
                "start": [s0, 0],
                "end": [e0, len(lines[e0]) if e0 < len(lines) else 0]
            },
            "hash": _sha(text),
            "text": text
        }
        hit_items.append(item)

    return {
        "projectId": project_id,
        "baseline": baseline,
        "items": hit_items,
        "missing": missing
    }