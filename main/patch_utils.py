# main/patch_utils.py
from __future__ import annotations
from dataclasses import dataclass
from typing import List, Tuple, Dict, Any
from pathlib import Path
import re

from .utils import WORKSPACE
from .compare_utils import load_state_files, index_filemap  # 앵커→파일/범위 매핑 재사용


class RegionLockViolationError(Exception):
    """허용 영역(메서드 본문/임포트) 밖 변경 시 던지는 예외"""
    def __init__(self, violations: List[Dict[str, Any]], message: str = "region_lock_violation"):
        super().__init__(message)
        self.violations = violations

# 제한 상수 (필요시 조정)
MAX_FILES = 1
MAX_HUNKS = 10
MAX_ADDED = 300
MAX_DELETED = 300

@dataclass
class Hunk:
    src_start: int
    src_len: int
    dst_start: int
    dst_len: int
    lines: List[str]  # with prefixes ' ','+','-'

@dataclass
class FilePatch:
    path: str
    hunks: List[Hunk]

def parse_unified_diff(diff_text: str) -> List[FilePatch]:
    """
    매우 단순한 unified diff 파서 (한/영 섞인 줄도 OK).
    여러 파일 지원하지만 MVP에선 파일 1개만 허용.
    """
    lines = diff_text.splitlines()
    patches: List[FilePatch] = []
    i = 0
    cur: FilePatch | None = None
    
    while i < len(lines):
        line = lines[i]
        
        # Skip metadata lines
        if line.startswith('diff ') or line.startswith('index '):
            i += 1
            continue
            
        # File header start
        if line.startswith('--- '):
            # 파일 경로 추출
            path = None
            # 다음 줄에서 +++ 헤더 찾기
            j = i + 1
            while j < len(lines):
                if lines[j].startswith('+++ '):
                    plus_line = lines[j]
                    # '+++ b/path' 또는 '+++ path' 형태에서 경로 추출
                    path_part = plus_line.split('\t')[0].split(' ', 1)[1]
                    if path_part.startswith('a/') or path_part.startswith('b/'):
                        path = path_part[2:]
                    else:
                        path = path_part
                    break
                j += 1
            
            if path is None:
                raise ValueError("could not determine file path in diff")
                
            cur = FilePatch(path=path, hunks=[])
            patches.append(cur)
            i = j + 1  # skip the +++ line
            continue
            
        # Hunk header
        if line.startswith('@@'):
            if cur is None:
                raise ValueError("hunk found before file header")
                
            # @@ -a,b +c,d @@ 파싱
            m = re.match(r'^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@', line)
            if not m:
                raise ValueError(f"bad hunk header: {line}")
                
            src_start = int(m.group(1))
            src_len = int(m.group(2) or "1")
            dst_start = int(m.group(3)) 
            dst_len = int(m.group(4) or "1")
            
            # 헝크 본문 수집
            hunk_lines: List[str] = []
            i += 1
            while i < len(lines):
                line = lines[i]
                
                # 다른 헝크나 파일이 시작되면 중단
                if line.startswith('@@') or line.startswith('diff ') or line.startswith('--- '):
                    break
                    
                # 빈 줄이거나 prefix 없는 줄은 컨텍스트로 처리
                if not line or line[0] not in (' ', '+', '-'):
                    hunk_lines.append(' ' + line)
                else:
                    hunk_lines.append(line)
                i += 1
            
            cur.hunks.append(Hunk(src_start, src_len, dst_start, dst_len, hunk_lines))
            continue
            
        i += 1
    
    return patches

def apply_patch_to_text(orig: List[str], h: Hunk) -> Tuple[List[str], List[int]]:
    """
    매우 단순 적용기: 헤더의 src_start/src_len을 신뢰해 적용.
    반환: (새 라인 목록, 변경된 목적지 라인 인덱스들[1-based])
    """
    # 1-based → 0-based
    s0 = h.src_start - 1
    if s0 < 0:
        s0 = 0
        
    # 잘라 붙이기: orig[:s0] + patched_block + orig[s0+src_len:]
    left = orig[:s0]
    right = orig[s0 + h.src_len:] if s0 + h.src_len < len(orig) else []
    
    new_block: List[str] = []
    changed_dst_lines: List[int] = []
    dst_line_counter = h.dst_start
    
    for ln in h.lines:
        if ln.startswith(' '):
            # 컨텍스트 라인
            new_block.append(ln[1:])
            dst_line_counter += 1
        elif ln.startswith('-'):
            # 삭제: 목적지에 없음, 소스에서만 제거
            pass
        elif ln.startswith('+'):
            # 추가: 목적지에 새 라인 추가
            new_block.append(ln[1:])
            changed_dst_lines.append(dst_line_counter)
            dst_line_counter += 1
        else:
            # prefix 없는 라인은 컨텍스트로 처리
            new_block.append(ln)
            dst_line_counter += 1
    
    return left + new_block + right, changed_dst_lines

def import_zone_range(text_lines: List[str]) -> Tuple[int, int]:
    """
    파일 상단의 import 블럭 라인 범위(1-based, inclusive).
    package 라인 이후 연속된 import 구간만 허용.
    """
    pkg_end = 0
    
    # package 라인 찾기
    for i, line in enumerate(text_lines):
        if line.strip().startswith("package "):
            pkg_end = i + 1  # 1-based
            break
    
    # import 구간 찾기
    start = None
    end = None
    
    for i in range(pkg_end, len(text_lines)):
        line = text_lines[i].strip()
        if line.startswith("import "):
            if start is None:
                start = i + 1  # 1-based
            end = i + 1  # 1-based
        elif start is not None and line and not line.startswith("//"):
            # import가 아닌 의미있는 라인이 나오면 import 구간 종료
            break
    
    if start is None:
        # import가 아직 없으면 package 다음 라인이 시작점
        start = pkg_end + 1
        end = pkg_end
    
    return start, max(end or pkg_end, pkg_end)

def validate_region_lock(
    file_text: str,
    file_hunks: List[Hunk],
    anchor_ranges: Dict[str, Dict[str, Any]],
    allowed_ops: List[str],
    target_anchor: str,
    file_path: str = "unknown.java"
) -> None:
    """
    Region Lock 검증:
    - EDIT_METHOD_BODY: 모든 hunk의 영향 구간이 대상 메서드 본문 범위에만 있어야 함
    - ADD_IMPORT: import zone에 '+' 라인만 존재해야 함
    """
    lines = file_text.splitlines()
    violations = []
    
    # 타겟 앵커 범위 확인
    if target_anchor not in anchor_ranges:
        raise ValueError(f"target anchor not found in current index: {target_anchor}")
    
    rng = anchor_ranges[target_anchor]["range"]
    body_s = rng["start"][0] + 1  # 1-based
    body_e = rng["end"][0] + 1
    
    # import 구간 범위
    imp_s, imp_e = import_zone_range(lines)
    
    for h_idx, h in enumerate(file_hunks):
        # 변경량 검사
        add_cnt = sum(1 for ln in h.lines if ln.startswith('+'))
        del_cnt = sum(1 for ln in h.lines if ln.startswith('-'))
        
        if add_cnt > MAX_ADDED or del_cnt > MAX_DELETED:
            raise ValueError(f"patch too large: +{add_cnt}/-{del_cnt} lines (max: +{MAX_ADDED}/-{MAX_DELETED})")
        
        # 헝크가 영향을 주는 소스 범위
        src_s = h.src_start
        src_e = h.src_start + max(h.src_len - 1, 0)
        
        # ADD_IMPORT 검사: import zone의 추가만 허용
        is_import_only = True
        for ln in h.lines:
            if ln.startswith('+'):
                # import zone 범위에 있는지 확인
                if not (imp_s <= h.dst_start <= imp_e + 10):  # 여유 범위
                    is_import_only = False
                    break
            elif ln.startswith('-'):
                # import zone에서 삭제는 허용하지 않음 (보수적 접근)
                is_import_only = False
                break
        
        # 허용 여부 검사
        ok = False
        violation_reason = None
        
        if "EDIT_METHOD_BODY" in allowed_ops:
            # 메서드 본문 범위 내에서만 수정 허용
            if src_s >= body_s and src_e <= body_e:
                ok = True
            else:
                violation_reason = "OUT_OF_METHOD_BODY"
        
        if "ADD_IMPORT" in allowed_ops:
            # import zone에 추가만 허용
            if is_import_only:
                ok = True
            elif violation_reason is None:
                violation_reason = "IMPORT_ONLY_ALLOWED"
        
        if not ok:
            violations.append({
                "file": file_path,
                "hunkIndex": h_idx + 1,  # 1-based
                "reason": violation_reason or "UNKNOWN_VIOLATION",
                "anchor": target_anchor,
                "allowed": {"start": body_s, "end": body_e},
                "attempted": {"start": src_s, "end": src_e},
            })
    
    # 위반사항이 있으면 RegionLockViolationError 발생
    if violations:
        raise RegionLockViolationError(violations)

def apply_unified_patch_with_guards(
    project_id: str,
    targets: List[str],
    allowed_ops: List[str],
    patch: Dict[str, Any]
) -> Dict[str, Any]:
    """
    통합된 패치 적용 with 가드
    
    Args:
        project_id: 프로젝트 ID
        targets: 대상 앵커들 (MVP에서는 1개만)
        allowed_ops: 허용된 작업 유형
        patch: 패치 정보 {format:'unified', diff:'...', file?:'relative/path.java'}
        
    Returns:
        적용 결과 정보
    """
    if patch.get("format") != "unified":
        raise ValueError("only unified diff supported")

    diff_text = patch.get("diff", "")
    if not diff_text.strip():
        raise ValueError("empty diff")
    
    # 패치 파싱
    try:
        patches = parse_unified_diff(diff_text)
    except Exception as e:
        raise ValueError(f"failed to parse diff: {e}")
    
    # file 필드가 있지만 diff에 헤더가 없는 경우 처리
    if len(patches) == 0 and patch.get("file"):
        patches = [FilePatch(path=patch["file"], hunks=[])]
        
    # 파일 개수 가드
    if len(patches) > MAX_FILES:
        raise ValueError(f"multiple files not allowed in MVP (got {len(patches)}, max {MAX_FILES})")
    
    if len(patches) == 0:
        raise ValueError("no files found in patch")

    # 현재 상태 인덱스(working)
    files_map = load_state_files("working")
    idx = index_filemap(files_map)
    anchors = idx["anchors"]

    # 타겟 검증
    if not targets:
        raise ValueError("targets required")
    target_anchor = targets[0]  # MVP: 1개만

    changed_files = []
    total_hunks = 0

    for fp in patches:
        rel_path = fp.path.replace("\\", "/")
        
        # 파일 존재 확인
        if rel_path not in files_map:
            raise ValueError(f"file not found in workspace: {rel_path}")
        
        orig_text = files_map[rel_path]
        file_hunks = fp.hunks
        total_hunks += len(file_hunks)
        
        # 헝크 개수 가드
        if total_hunks > MAX_HUNKS:
            raise ValueError(f"too many hunks (got {total_hunks}, max {MAX_HUNKS})")

        # Region Lock 검사
        validate_region_lock(orig_text, file_hunks, anchors, allowed_ops, target_anchor, rel_path)

        # 실제 적용
        orig_lines = orig_text.splitlines()
        new_lines = orig_lines[:]
        changed_lines_accum: List[int] = []
        
        # hunks를 뒤에서부터 적용 (라인 번호 변화 최소화)
        for h in reversed(file_hunks):
            new_lines, changed = apply_patch_to_text(new_lines, h)
            changed_lines_accum.extend(changed)

        # 파일 저장
        dst_path = (Path(WORKSPACE) / rel_path).resolve()
        dst_path.parent.mkdir(parents=True, exist_ok=True)
        new_content = "\n".join(new_lines)
        dst_path.write_text(new_content, encoding="utf-8")

        changed_files.append({
            "file": rel_path,
            "changedLines": sorted(set(changed_lines_accum)),
            "totalLines": len(new_lines)
        })

    return {"changedFiles": changed_files}