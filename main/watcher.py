# main/watcher.py
from __future__ import annotations
import threading, time, asyncio
from pathlib import Path
from typing import Set
from .utils import WORKSPACE

def _rel(p: Path) -> str:
    try:
        return str(p.resolve().relative_to(Path(WORKSPACE).resolve())).replace("\\","/")
    except Exception:
        return str(p).replace("\\", "/")

def start_watcher() -> None:
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
            for changes in watch(WORKSPACE, recursive=True):
                if not changes:  # keep-alive
                    continue
                
                # changes: set[(Change, path)]
                paths: Set[str] = set()
                for change_type, p in changes:
                    path_str = str(p)
                    # .java 파일만 처리
                    if not path_str.endswith(".java"): 
                        continue
                    # build/, out/, .git/ 등 제외
                    if any(exclude in path_str for exclude in ["/build/", "/out/", "/.git/", "\\build\\", "\\out\\", "\\.git\\"]):
                        continue
                    try:
                        rel_path = _rel(Path(p))
                        paths.add(rel_path)
                        print(f"[watcher] detected change: {change_type} {rel_path}")
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
                
                # 이벤트 발행 (비동기 컨텍스트에서 실행)
                try:
                    from .event_bus import BUS
                    # 새 이벤트 루프에서 발행
                    def publish_event():
                        try:
                            loop = asyncio.new_event_loop()
                            asyncio.set_event_loop(loop)
                            loop.run_until_complete(BUS.publish(evt))
                            loop.close()
                        except Exception as e:
                            print(f"[watcher] error publishing event: {e}")
                    
                    # 별도 스레드에서 실행
                    pub_thread = threading.Thread(target=publish_event, daemon=True)
                    pub_thread.start()
                except Exception as e:
                    print(f"[watcher] error setting up event publishing: {e}")
                    
        except Exception as e:
            print(f"[watcher] error in main loop: {e}")

    th = threading.Thread(target=run, name="workspace-watcher", daemon=True)
    th.start()
    print("[watcher] thread started")