# main/utils.py
from pathlib import Path
import os

def get_workspace():
    """현재 설정된 워크스페이스 경로 반환

    Returns:
        str | None: 워크스페이스 경로, 설정되지 않았으면 None
    """
    from app import app
    workspace = getattr(app.state, "workspace", None)
    return workspace

# 하위 호환성을 위한 속성 (동적으로 get_workspace() 호출)
# 사용법: from .utils import WORKSPACE
# WORKSPACE 변수처럼 사용되지만 실제로는 get_workspace()를 호출함
@property
def _workspace_property(self):
    return get_workspace()

# WORKSPACE를 직접 임포트하는 코드들을 위한 호환성 유지
# 실제로는 get_workspace()를 호출하는 문자열 반환
class _WorkspaceProxy:
    """WORKSPACE 상수를 동적으로 만드는 프록시"""
    def __str__(self):
        return get_workspace()

    def __repr__(self):
        return get_workspace()

    def __fspath__(self):
        """Path() 생성자에서 사용 가능하도록"""
        return get_workspace()

WORKSPACE = _WorkspaceProxy()

def ensure_workspace():
    """워크스페이스 디렉터리가 존재하는지 확인

    Returns:
        str | None: 워크스페이스 경로, 설정되지 않았거나 존재하지 않으면 None
    """
    workspace = get_workspace()
    if not workspace:
        return None
    if not Path(workspace).exists():
        return None
    return workspace