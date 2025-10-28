# main/diff_utils.py
from __future__ import annotations
from pathlib import Path
from typing import Dict, Any, List, Tuple, Optional
import difflib, re

from .utils import WORKSPACE
from .compare_utils import load_state_files

# 간단한 인메모리 스토어 (실제로는 index_store 모듈이 있다면 그것 사용)
class SimpleStore:
    def __init__(self):
        self.files = {}
        self.anchors = {}
        self.reverse = {}  # file -> [anchors]
        self._lock = None
    
    def rebuild(self):
        # 실제 구현에서는 Java 파일 인덱싱
        pass

STORE = SimpleStore()

CLASS_HDR_RE = re.compile(r"\b(class|interface|enum)\s+([A-Za-z_]\w*)")
METHOD_SIG_RE = re.compile(
    r"""(
        (?:public|protected|private|static|final|abstract|synchronized|native|default|strictfp|\s)+?
        [\w\[\]<>.?]+\s+[A-Za-z_][$\w]*\s*\([^;{]*\)(?:\s*throws\s+[^{]+)?
    )\s*\{""", re.X
)

def _find_class_region(text: str, cls_name: str) -> Tuple[int,int]:
    """해당 클래스 블록(대략) 범위를 라인 인덱스로 돌려준다 (0-based, inclusive)"""
    pos = [m.start() for m in CLASS_HDR_RE.finditer(text) if m.group(2) == cls_name]
    if not pos:
        return (0, len(text.splitlines())-1)
    start = pos[0]
    # 다음 클래스 시작 전까지
    nxt = [m.start() for m in CLASS_HDR_RE.finditer(text) if m.start() > start]
    end_byte = nxt[0] if nxt else len(text)
    lines = text.splitlines()
    # 대략 라인 변환
    upto = text[:end_byte].splitlines()
    start_line = text[:start].count("\n")
    end_line = len(upto) - 1
    return (start_line, end_line)

def _find_method_body_by_sig(text: str, cls_name: str, sig_text: str) -> Tuple[int,int,str]:
    """
    클래스 영역에서 동일한 시그니처를 찾아 본문 라인 범위를 반환 (0-based, inclusive)
    반환: (start_line, end_line, body_text)
    """
    cls_s, cls_e = _find_class_region(text, cls_name)
    lines = text.splitlines()
    seg = "\n".join(lines[cls_s:cls_e+1])

    # 같은 시그니처를 찾아서 { ... } 바디를 추출
    m = None
    for mm in METHOD_SIG_RE.finditer(seg):
        sig = mm.group(1).strip()
        if sig.strip() == sig_text.strip():
            m = mm
            break
    if not m:
        # 못 찾으면 파일 전체에서 시도
        for mm in METHOD_SIG_RE.finditer(text):
            sig = mm.group(1).strip()
            if sig.strip() == sig_text.strip():
                seg = text
                cls_s = 0
                m = mm
                break
    if not m:
        raise ValueError("method signature not found in snapshot")

    seg_lines = seg.splitlines()
    sig_pos = m.start()
    head = seg[:sig_pos].splitlines()
    s_line = len(head)

    # 중괄호 매칭
    body_start = seg.find("{", m.end() - len(seg))
    if body_start < 0:
        raise ValueError("method body start not found")
    i = body_start + 1; depth = 1
    while i < len(seg) and depth > 0:
        c = seg[i]
        if c == "{": depth += 1
        elif c == "}": depth -= 1
        i += 1
    if depth != 0:
        raise ValueError("method body not closed")

    body = seg[body_start+1:i-1]
    body_head = seg[:body_start+1].splitlines()
    bs_line = len(body_head)  # 시그니처 라인 바로 다음이 1줄로 가정

    # 파일 기준 라인으로 환산
    start_line = cls_s + bs_line
    end_line   = start_line + body.count("\n")
    return (start_line, end_line, body)

def _smart_decode(b: bytes) -> str:
    for enc in ("utf-8","cp949","euc-kr","latin-1"):
        try: return b.decode(enc)
        except UnicodeDecodeError: pass
    return b.decode("utf-8","replace")

def _get_working_method_body(anchor: str) -> Tuple[str, str, int, int, str]:
    """returns (file, cls_name, start_line, end_line, body_text) for working"""
    # 간단 구현: anchor에서 파일과 위치 추정
    if not anchor.startswith("m:"):
        raise KeyError("invalid anchor format")
    
    # anchor 파싱: m:com.example.Parser.parseTokens(String)
    rest = anchor[2:]  # com.example.Parser.parseTokens(String)
    
    # 메서드명과 클래스 분리
    if "(" in rest:
        method_part = rest.split("(")[0]  # com.example.Parser.parseTokens
        class_part = ".".join(method_part.split(".")[:-1])  # com.example.Parser
        method_name = method_part.split(".")[-1]  # parseTokens
    else:
        raise KeyError("invalid method anchor format")
    
    # 파일 경로 추정
    package_parts = class_part.split(".")
    class_name = package_parts[-1]
    package_path = "/".join(package_parts[:-1]) if len(package_parts) > 1 else ""
    
    file_path = f"{package_path}/{class_name}.java" if package_path else f"{class_name}.java"
    
    # 실제 파일 읽기
    full_path = Path(WORKSPACE) / file_path
    if not full_path.exists():
        # 다른 경로에서 찾기 시도
        for java_file in Path(WORKSPACE).rglob(f"{class_name}.java"):
            full_path = java_file
            file_path = str(java_file.relative_to(WORKSPACE)).replace("\\", "/")
            break
        else:
            raise KeyError(f"file not found: {file_path}")
    
    text = _smart_decode(full_path.read_bytes())
    lines = text.splitlines()
    
    # 메서드 찾기 (간단 구현)
    method_start = -1
    method_end = -1
    
    for i, line in enumerate(lines):
        if method_name in line and ("public" in line or "private" in line or "protected" in line):
            # 메서드 시작 라인 추정
            method_start = i
            # 중괄호 찾아서 끝 라인 추정
            brace_depth = 0
            start_found = False
            for j in range(i, len(lines)):
                line_content = lines[j]
                for char in line_content:
                    if char == '{':
                        brace_depth += 1
                        start_found = True
                    elif char == '}':
                        brace_depth -= 1
                        if start_found and brace_depth == 0:
                            method_end = j
                            break
                if method_end >= 0:
                    break
            break
    
    if method_start < 0 or method_end < 0:
        raise KeyError("method not found in file")
    
    body = "\n".join(lines[method_start:method_end+1])
    return (file_path, class_name, method_start, method_end, body)

def _cls_from_anchor(anchor: str) -> str:
    """m:com.example.Text.String parse(String) → Text"""
    rest = anchor.split(":",1)[1]
    head = rest.split(" ",1)[0]          # com.example.Text.String
    cls_fq = head.rsplit(".",1)[0]       # com.example.Text
    return cls_fq.split(".")[-1]

def _sig_from_anchor(anchor: str) -> str:
    """anchor에서 시그니처 추출 (간단 버전)"""
    # 실제로는 STORE.anchors[anchor]['sig']에서 가져와야 함
    # 지금은 anchor 자체에서 추정
    if "(" in anchor:
        method_part = anchor.split("(")[0].split(".")[-1]
        param_part = anchor.split("(")[1].rstrip(")")
        return f"public void {method_part}({param_part})"  # 간단 추정
    return "public void method()"

def method_line_diff(baseline: str, anchor: str) -> Dict[str, Any]:
    """
    baseline 스냅샷과 working 사이의 해당 메서드 본문 라인 diff 반환
    """
    try:
        file, cls_name, work_s, work_e, work_body = _get_working_method_body(anchor)
        sig = _sig_from_anchor(anchor)

        state_files = load_state_files(baseline)  # {relPath: text}
        if file not in state_files:
            # baseline에 없으면 'added'
            new_lines = work_body.splitlines()
            return {
                "anchor": anchor, "kind": "added",
                "oldLoc": 0, "newLoc": len(new_lines),
                "hunks": [{"type":"add","old":[0,0],"new":[1,len(new_lines)]}]
            }
        
        base_text = state_files[file]
        try:
            base_s, base_e, base_body = _find_method_body_by_sig(base_text, cls_name, sig)
        except ValueError:
            # baseline에서 메서드를 찾을 수 없으면 added로 처리
            new_lines = work_body.splitlines()
            return {
                "anchor": anchor, "kind": "added",
                "oldLoc": 0, "newLoc": len(new_lines),
                "hunks": [{"type":"add","old":[0,0],"new":[1,len(new_lines)]}]
            }
        
        old_lines = base_body.splitlines()
        new_lines = work_body.splitlines()

        # difflib으로 라인 범위 계산
        sm = difflib.SequenceMatcher(a=old_lines, b=new_lines, autojunk=False)
        hunks: List[Dict[str, Any]] = []
        for tag, i1, i2, j1, j2 in sm.get_opcodes():
            if tag == "equal": 
                continue
            t = "mod" if tag == "replace" else ("del" if tag == "delete" else "add")
            # 1-based inclusive 범위로 표기
            old_range = [i1+1, max(i2, i1)+0] if t=="add" else [i1+1, i2]
            new_range = [j1+1, max(j2, j1)+0] if t=="del" else [j1+1, j2]
            hunks.append({"type": t, "old": old_range, "new": new_range})

        kind = "modified" if hunks else "equal"
        return {
            "anchor": anchor, "kind": kind,
            "oldLoc": len(old_lines), "newLoc": len(new_lines),
            "hunks": hunks
        }
    except Exception as e:
        # 에러 발생시 빈 diff로 처리
        return {
            "anchor": anchor, "kind": "equal",
            "oldLoc": 0, "newLoc": 0,
            "hunks": []
        }