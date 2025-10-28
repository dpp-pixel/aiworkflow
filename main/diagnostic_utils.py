# main/diagnostic_utils.py
from __future__ import annotations
from pathlib import Path
from typing import Dict, Any, List, Tuple
import os, re, subprocess, sys, shlex, platform

from .utils import WORKSPACE
from .compare_utils import load_state_files, index_filemap  # 앵커→파일/라인 매핑 재사용

BUILD_DIR = Path("./.contextpanel/build").resolve()
CLASSES_DIR = BUILD_DIR / "classes"

JAVAC_ERROR_RE = re.compile(
    r"^(?P<file>.+\.java):(?P<line>\d+): (?P<sev>error|warning): (?P<msg>.+)$"
)

def _collect_source_files() -> List[Path]:
    return [p for p in Path(WORKSPACE).rglob("*.java")]

def _default_classpath() -> str:
    # libs/, lib/ 아래 .jar 자동 포함 + 환경 CLASSPATH 존중
    jars = []
    for d in ("lib", "libs"):
        jdir = (Path(WORKSPACE) / d)
        if jdir.exists():
            jars += [str(p) for p in jdir.glob("**/*.jar")]
    cp = os.environ.get("CLASSPATH", "")
    parts = [cp] if cp else []
    parts += jars
    sep = ";" if platform.system().lower().startswith("win") else ":"
    return sep.join([p for p in parts if p])

def run_javac_compile() -> Tuple[int, str, str]:
    sources = _collect_source_files()
    CLASSES_DIR.mkdir(parents=True, exist_ok=True)
    if not sources:
        return (0, "", "")  # 컴파일할 파일 없음

    cp = _default_classpath()
    args = ["javac", "-encoding", "UTF-8", "-d", str(CLASSES_DIR)]
    if cp:
        args += ["-cp", cp]
    args += [str(p) for p in sources]
    # 플랫폼 안전 실행
    try:
        proc = subprocess.run(args, cwd=str(WORKSPACE), capture_output=True, text=True, timeout=180)
    except FileNotFoundError:
        return (127, "", "javac not found in PATH")
    return (proc.returncode, proc.stdout, proc.stderr)

def parse_javac_output(stdout: str, stderr: str) -> List[Dict[str, Any]]:
    """
    javac 표준 에러 라인을 파싱해 {file,line,severity,message} 리스트 반환.
    """
    diags: List[Dict[str, Any]] = []
    text = "\n".join([stderr, stdout])
    for line in text.splitlines():
        m = JAVAC_ERROR_RE.match(line.strip())
        if not m: 
            continue
        diags.append({
            "file": m.group("file").replace("\\", "/"),
            "line": int(m.group("line")),
            "severity": "error" if m.group("sev") == "error" else "warning",
            "message": m.group("msg").strip()
        })
    return diags

def map_diags_to_anchors(diags: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    파일/라인 기반 진단을 현재 작업 트리의 앵커(메서드/클래스)로 매핑.
    메서드 범위에 포함되면 anchor=m:..., 아니면 cls:...에 베스트에포트.
    """
    files_map = load_state_files("working")
    idx = index_filemap(files_map)      # anchors: id -> {file, range}
    anchors = idx["anchors"]            # 메서드 앵커만 포함됨(현 단계)
    # 파일 -> [ (anchor, startLine, endLine) ] 인덱스 역구성
    file_buckets: Dict[str, List[Tuple[str,int,int]]] = {}
    for aid, meta in anchors.items():
        path = meta["file"]; r = meta["range"]
        s = r["start"][0] + 1  # 1-based
        e = r["end"][0] + 1
        file_buckets.setdefault(path, []).append((aid, s, e))

    mapped: List[Dict[str, Any]] = []
    for d in diags:
        file = d["file"]
        line = d["line"]
        anchor = None
        # 메서드 범위 매칭
        for (aid, s, e) in file_buckets.get(file, []):
            if s <= line <= e:
                anchor = aid
                break
        item = {
            "kind": "compile",
            "severity": d["severity"],
            "message": d["message"],
            "file": file,
            "range": {"start":[line-1, 0], "end":[line-1, 0]}
        }
        if anchor:
            item["anchor"] = anchor
        mapped.append(item)
    return mapped

def run_gradle_test_if_available() -> Tuple[int, str, str] | None:
    """
    gradlew가 있으면 gradle test를 실행하고 결과 반환. 없으면 None.
    """
    gradlew = (Path(WORKSPACE) / "gradlew")
    gradlew_win = (Path(WORKSPACE) / "gradlew.bat")
    if gradlew.exists() or gradlew_win.exists():
        cmd = ["./gradlew", "test", "-q"]
        if platform.system().lower().startswith("win"):
            cmd = ["cmd", "/c", "gradlew.bat", "test", "-q"]
        try:
            proc = subprocess.run(cmd, cwd=str(WORKSPACE), capture_output=True, text=True, timeout=300)
            return (proc.returncode, proc.stdout, proc.stderr)
        except (subprocess.TimeoutExpired, FileNotFoundError):
            return (1, "", "Gradle test execution failed")
    return None

TEST_FAIL_RE = re.compile(r"(AssertionError|failed|FAILURE):?\s*(.+)")

def parse_gradle_test(stdout: str, stderr: str) -> List[Dict[str, Any]]:
    """
    간단 요약: 실패 메시지 라인을 Diagnostic로 변환(정밀 매핑은 후속).
    """
    diags: List[Dict[str, Any]] = []
    for line in (stdout + "\n" + stderr).splitlines():
        m = TEST_FAIL_RE.search(line)
        if not m: 
            continue
        diags.append({
            "kind": "test",
            "severity": "error",
            "message": line.strip(),
            # 추후 anchor/file/range를 스택트레이스로 정밀 매핑
        })
    return diags