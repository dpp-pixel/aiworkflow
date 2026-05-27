# main/watcher.py
from __future__ import annotations
import threading, asyncio, difflib, json
from pathlib import Path
from typing import Set
from .utils import WORKSPACE

_stop_event: threading.Event | None = None

def _compute_diff(rel_path: str, current_content: str) -> str | None:
    """마지막 체크포인트 대비 unified diff 계산"""
    try:
        from .checkpoint_utils import list_checkpoints, BLOBS, MANI
        checkpoints = list_checkpoints()
        if not checkpoints:
            return None
        mani_path = MANI / f"{checkpoints[0]['id']}.json"
        manifest = json.loads(mani_path.read_text(encoding="utf-8"))
        for f in manifest.get("files", []):
            if f["path"] == rel_path:
                blob = BLOBS / f["sha"][:2] / f["sha"]
                old = blob.read_text(encoding="utf-8", errors="ignore")
                lines = list(difflib.unified_diff(
                    old.splitlines(keepends=True),
                    current_content.splitlines(keepends=True),
                    fromfile=f"a/{rel_path}", tofile=f"b/{rel_path}", n=3
                ))
                result = "".join(lines)
                return result[:5000] if result else None
    except Exception:
        pass
    return None


def _rel(p: Path) -> str:
    try:
        return str(p.resolve().relative_to(Path(WORKSPACE).resolve())).replace("\\","/")
    except Exception:
        return str(p).replace("\\", "/")

def restart_watcher() -> None:
    """현재 실행 중인 워처를 중단하고 새 워크스페이스로 재시작."""
    global _stop_event
    if _stop_event is not None:
        _stop_event.set()
    _stop_event = threading.Event()
    start_watcher(_stop_event)


def start_watcher(stop_event: threading.Event | None = None) -> None:
    """
    WORKSPACE 내 .java 변경 감지 → 이벤트 발행
    """
    try:
        from watchfiles import watch
    except ImportError:
        print("[watcher] 'watchfiles' 미설치. 워처 비활성화.")
        return

    def run():
        print(f"[watcher] started for {WORKSPACE}")
        try:
            for changes in watch(WORKSPACE, recursive=True, stop_event=stop_event):
                if not changes:  # keep-alive
                    continue
                
                # changes: set[(Change, path)]
                paths: Set[str] = set()
                for change_type, p in changes:
                    path_str = str(p)
                    from .indexers import all_extensions
                    if not any(path_str.endswith(ext) for ext in all_extensions()):
                        continue
                    if any(ex in path_str for ex in ["/build/", "/out/", "/.git/", "\\build\\", "\\out\\", "\\.git\\"]):
                        continue
                    try:
                        rel_path = _rel(Path(p))
                        paths.add(rel_path)
                        print(f"[watcher] detected change: {change_type} {rel_path}")

                        # 로그 기록 + 자동 분석
                        try:
                            from watchfiles import Change
                            kind = {Change.added: "created", Change.modified: "modified",
                                    Change.deleted: "deleted"}.get(change_type, "modified")
                            diff = None
                            if kind != "deleted" and Path(p).exists():
                                content = Path(p).read_text(encoding="utf-8", errors="ignore")
                                diff = _compute_diff(rel_path, content)
                            from logs.utils import log_file_change
                            log_id = log_file_change(rel_path, kind, diff)
                            if log_id and log_id > 0:
                                import threading as _t
                                from main.routes import _auto_analyze_log
                                _t.Thread(target=_auto_analyze_log, args=(log_id,), daemon=True).start()
                        except Exception as le:
                            print(f"[watcher] log error: {le}")

                    except Exception as e:
                        print(f"[watcher] error processing {p}: {e}")
                        continue
                
                if not paths:
                    continue
                
                # 대규모 변경 감지
                if len(paths) > 20:
                    evt = {
                        "type": "full_reindex",
                        "paths": list(paths),
                        "reason": "bulk_changes"
                    }
                else:
                    evt = {
                        "type": "index_updated",
                        "paths": list(paths),
                        "touchedAnchors": []  # 실제로는 인덱스 업데이트 후 계산
                    }
                
                # 이벤트 발행
                try:
                    from .event_bus import BUS
                    BUS.publish_sync(evt)
                except Exception as e:
                    print(f"[watcher] error publishing event: {e}")
                    
        except Exception as e:
            print(f"[watcher] error in main loop: {e}")

    th = threading.Thread(target=run, name="workspace-watcher", daemon=True)
    th.start()
    print("[watcher] thread started")