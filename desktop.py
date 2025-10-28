# desktop.py
import threading, time, webview, uvicorn, requests, os
from app import app

# === 새로 추가 ===
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

MAIN_WINDOW = None
observer = None

# 개발 모드 설정
DEV_MODE = True
FRONTEND_URL = "http://localhost:5173" if DEV_MODE else "http://127.0.0.1:8001"
BACKEND_PORT = 8001

class Debounce:
    def __init__(self, delay=1.0):
        self.delay = delay
        self.t = None
    def call(self, fn):
        if self.t:
            self.t.cancel()
        self.t = threading.Timer(self.delay, fn)
        self.t.start()

class MdHandler(FileSystemEventHandler):
    def __init__(self, root, on_change):
        self.root = root
        self.on_change = on_change
        self.exts = ('.md', '.MD', '.mdx', '.MDX', '.markdown', '.MARKDOWN')
    def on_any_event(self, event):
        if event.is_directory:
            return
        path = event.src_path
        if not path.endswith(self.exts):
            return
        self.on_change()

def start_watch(root):
    """루트 폴더의 .md 변경을 감지해 /workspace/scan → 파일목록 새로고침"""
    global observer
    if observer:
        observer.stop()
        observer.join()

    deb = Debounce(1.0)  # 변경 몰림 방지(1초 디바운스)

    def rescan_and_refresh():
        try:
            requests.post(f"http://127.0.0.1:{BACKEND_PORT}/workspace/scan", timeout=5)
            if MAIN_WINDOW:
                MAIN_WINDOW.evaluate_js("refreshFiles()")  # UI의 파일 목록 갱신 함수 호출
        except Exception:
            pass

    handler = MdHandler(root, lambda: deb.call(rescan_and_refresh))
    observer = Observer()
    observer.schedule(handler, root, recursive=True)
    observer.start()

def try_restore_workspace():
    try:
        cfg = requests.get(f"http://127.0.0.1:{BACKEND_PORT}/settings", timeout=5).json()
        ws = cfg.get("last_workspace")
        if ws and os.path.isdir(ws):
            r = requests.post(f"http://127.0.0.1:{BACKEND_PORT}/workspace/set",
                              json={"path": ws}, timeout=10).json()
            # 자동감시 옵션이 켜져 있으면 기존 start_watch(path) 호출
            if cfg.get("auto_scan", True):
                try:
                    start_watch(ws)
                except Exception:
                    pass
            # UI 초기화
            if MAIN_WINDOW:
                MAIN_WINDOW.evaluate_js("""
                  if (typeof refreshFiles==='function') refreshFiles();
                  if (typeof renderCtxPicker==='function') renderCtxPicker();
                """)
    except Exception:
        pass
# === 새로 추가 끝 ===

def run_api():
    uvicorn.run(app, host="127.0.0.1", port=BACKEND_PORT, log_level="info")

class Bridge:
    def pick_workspace(self):
        paths = webview.windows[0].create_file_dialog(webview.FileDialog.FOLDER)
        if not paths:
            return {"ok": False}
        path = paths[0]
        # 프론트엔드에서 서버 설정을 하도록 path만 반환
        start_watch(path)  # ← 워크스페이스 설정되면 바로 감시 시작
        return {"ok": True, "path": path}

def wait_for_server(url, timeout=30):
    """서버가 준비될 때까지 대기"""
    import time
    start = time.time()
    while time.time() - start < timeout:
        try:
            response = requests.get(url, timeout=1)
            if response.status_code == 200:
                return True
        except:
            pass
        time.sleep(0.5)
    return False

if __name__ == "__main__":
    # 백엔드 시작
    t = threading.Thread(target=run_api, daemon=True)
    t.start()

    # 백엔드가 준비될 때까지 대기
    print(f"백엔드 시작 중... (http://127.0.0.1:{BACKEND_PORT})")
    if not wait_for_server(f"http://127.0.0.1:{BACKEND_PORT}/healthz"):
        print("경고: 백엔드 시작 실패")

    # 개발 모드에서는 프론트엔드가 준비될 때까지 대기
    if DEV_MODE:
        print(f"프론트엔드 대기 중... ({FRONTEND_URL})")
        if not wait_for_server(FRONTEND_URL, timeout=60):
            print("경고: 프론트엔드 시작 실패 - Vite 서버를 먼저 시작했는지 확인하세요")

    # 데스크톱 앱 창 생성
    MAIN_WINDOW = webview.create_window(
        "맥락 패널",
        FRONTEND_URL,
        width=1100, height=800,
        js_api=Bridge()
    )

    # 워크스페이스 자동 복원
    def on_window_loaded():
        time.sleep(1)  # UI가 완전히 로드될 때까지 대기
        try_restore_workspace()

    threading.Thread(target=on_window_loaded, daemon=True).start()

    webview.start()
