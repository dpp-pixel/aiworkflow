# main/diagnostics_utils.py
from __future__ import annotations
from pathlib import Path
import os, re, subprocess, shlex
from typing import Dict, Any, List, Optional, Tuple
from .utils import WORKSPACE

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

JAVAC_RE = re.compile(r"^(?P<file>.+?):(?P<line>\d+):(?:(?P<col>\d+):)?\s*(?P<severity>error|warning):\s*(?P<msg>.*)$")

def _detect_build_tool(root: Path) -> str:
    if (root/"gradlew").exists() or (root/"build.gradle").exists(): 
        return "gradle"
    if (root/"mvnw").exists() or (root/"pom.xml").exists(): 
        return "maven"
    return "javac"

def _run(cmd: str, cwd: Path) -> Tuple[int, str, str]:
    try:
        p = subprocess.Popen(shlex.split(cmd), cwd=str(cwd), stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        out, err = p.communicate()
        return p.returncode, out, err
    except Exception as e:
        return 1, "", str(e)

def compile_project() -> Dict[str, Any]:
    """Gradle/Maven 있으면 그걸 쓰고, 없으면 javac로 src/**/*.java 시도"""
    root = Path(WORKSPACE).resolve()
    tool = _detect_build_tool(root)
    
    if tool == "gradle":
        exe = "gradlew" if (root/"gradlew").exists() else "gradle"
        code, out, err = _run(f"{exe} -q compileJava", root)
        text = (out or "") + "\n" + (err or "")
    elif tool == "maven":
        exe = "mvnw" if (root/"mvnw").exists() else "mvn"
        code, out, err = _run(f"{exe} -q -DskipTests compile", root)
        text = (out or "") + "\n" + (err or "")
    else:
        # naive javac (클래스패스/버전은 프로젝트에 맞게 확장 가능)
        sources = [str(p) for p in root.rglob("*.java")]
        if not sources:
            return {"tool": "javac", "exitCode": 0, "raw": "", "diagnostics": []}
        
        # out 디렉토리 생성
        out_dir = root / "out"
        out_dir.mkdir(exist_ok=True)
        
        code, out, err = _run(f"javac -Xlint -d {shlex.quote(str(out_dir))} " + " ".join(map(shlex.quote, sources)), root)
        text = (out or "") + "\n" + (err or "")
    
    return {"tool": tool, "exitCode": code, "raw": text, "diagnostics": parse_diagnostics(text)}

def parse_diagnostics(text: str) -> List[Dict[str, Any]]:
    diags: List[Dict[str, Any]] = []
    for line in text.splitlines():
        m = JAVAC_RE.match(line.strip())
        if not m: 
            continue
        d = m.groupdict()
        file = d["file"].replace("\\", "/")
        diags.append({
            "file": file,
            "line": int(d["line"]),
            "col": int(d["col"]) if d.get("col") else None,
            "severity": "error" if d["severity"] == "error" else "warning",
            "message": d["msg"].strip()
        })
    
    # 앵커 매핑 (간단 버전)
    for d in diags:
        rel = d["file"]
        # file이 절대경로로 찍히는 경우 상대경로로 정규화
        wp = Path(WORKSPACE).resolve()
        try:
            rel = str(Path(rel)).replace("\\","/")
            if rel.startswith(str(wp).replace("\\","/")):
                rel = rel[len(str(wp).replace("\\","/"))+1:]
        except Exception:
            pass
        d["file"] = rel
        
        # line -> anchor (간단 구현)
        d["anchor"] = None
        # 실제로는 STORE에서 찾아야 하지만 지금은 간단히 생성
        if d["file"].endswith(".java"):
            try:
                # 파일에서 클래스/메서드 찾기 (간단 버전)
                file_path = Path(WORKSPACE) / d["file"]
                if file_path.exists():
                    content = file_path.read_text(encoding="utf-8", errors="ignore")
                    lines = content.splitlines()
                    if d["line"] <= len(lines):
                        # 해당 라인 주변에서 메서드/클래스 찾기
                        for i in range(max(0, d["line"]-10), min(len(lines), d["line"]+5)):
                            line_content = lines[i]
                            # 간단한 메서드 패턴 매칭
                            method_match = re.search(r'\b(public|private|protected|static).*?\s+(\w+)\s*\(', line_content)
                            if method_match:
                                method_name = method_match.group(2)
                                # 패키지.클래스 추정
                                pkg_match = re.search(r'package\s+([a-zA-Z0-9_.]+)', content)
                                class_match = re.search(r'\bclass\s+(\w+)', content)
                                if pkg_match and class_match:
                                    pkg = pkg_match.group(1)
                                    cls = class_match.group(1)
                                    d["anchor"] = f"m:{pkg}.{cls}.{method_name}"
                                    break
            except Exception:
                pass
    
    return diags

def summarize(diags: List[Dict[str, Any]]) -> Dict[str, int]:
    errs = sum(1 for d in diags if d["severity"] == "error")
    warns = sum(1 for d in diags if d["severity"] == "warning")
    return {"errors": errs, "warnings": warns}