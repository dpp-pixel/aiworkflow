# logs/utils.py
"""
로그 유틸리티 모듈
AI 분석 결과 및 작업 이력을 기록
"""
import sqlite3
import time
import json
from pathlib import Path
from typing import Optional, Dict, Any


def get_db_path() -> str:
    """
    데이터베이스 경로 가져오기
    """
    # app.py에서 사용하는 경로와 동일하게
    workspace = Path(__file__).parent.parent / "test_workspace"
    db_path = workspace.parent / ".contextpanel" / "context.db"
    return str(db_path)


def get_conn():
    """
    데이터베이스 연결 가져오기
    """
    db_path = get_db_path()
    return sqlite3.connect(db_path)


def add_log_entry(
    type: str,
    title: str,
    details: Optional[str] = None,
    branch: str = "main",
    cp_id: Optional[int] = None,
    packet_path: Optional[str] = None
) -> int:
    """
    로그 항목 추가

    Args:
        type: 로그 타입 (예: "ai_analyze", "ai_plan", "patch_apply")
        title: 로그 제목
        details: 상세 정보 (JSON 문자열)
        branch: 브랜치명
        cp_id: 체크포인트 ID (선택)
        packet_path: 패킷 경로 (선택)

    Returns:
        생성된 로그 ID
    """
    try:
        conn = get_conn()
        cur = conn.cursor()

        cur.execute("""
            INSERT INTO logs (type, title, details, ts, branch, cp_id, packet_path)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (type, title, details, time.time(), branch, cp_id, packet_path))

        log_id = cur.lastrowid
        conn.commit()
        conn.close()

        return log_id

    except Exception as e:
        print(f"[ERROR] Failed to add log entry: {e}")
        return -1


def log_ai_analysis(
    method_name: str,
    result: Dict[str, Any],
    code_snippet: Optional[str] = None
) -> int:
    """
    AI 분석 결과를 로그에 저장

    Args:
        method_name: 분석한 메서드명
        result: analyze_runner의 반환값
        code_snippet: 분석한 코드 (선택)

    Returns:
        로그 ID
    """
    if result.get("ok"):
        data = result.get("data", {})
        title = f"AI Analysis: {method_name}"

        details = {
            "method_name": method_name,
            "purpose": data.get("purpose"),
            "complexity": data.get("complexity"),
            "externals": data.get("externals", []),
            "model": result.get("model", "unknown"),
            "duration": result.get("duration"),
            "code": code_snippet[:200] if code_snippet else None  # 처음 200자만
        }

        return add_log_entry(
            type="ai_analyze",
            title=title,
            details=json.dumps(details, ensure_ascii=False, indent=2)
        )
    else:
        # 실패한 경우도 기록
        title = f"AI Analysis Failed: {method_name}"
        details = {
            "method_name": method_name,
            "error": result.get("error"),
            "duration": result.get("duration")
        }

        return add_log_entry(
            type="ai_analyze_failed",
            title=title,
            details=json.dumps(details, ensure_ascii=False, indent=2)
        )


def log_ai_plan(
    target: str,
    plan_result: Dict[str, Any]
) -> int:
    """
    AI 계획(plan) 결과를 로그에 저장

    Args:
        target: 계획 대상 (클래스/메서드명)
        plan_result: plan 결과

    Returns:
        로그 ID
    """
    title = f"AI Plan: {target}"

    details = {
        "target": target,
        "plan": plan_result,
        "timestamp": time.time()
    }

    return add_log_entry(
        type="ai_plan",
        title=title,
        details=json.dumps(details, ensure_ascii=False, indent=2)
    )


def get_recent_logs(limit: int = 10, type_filter: Optional[str] = None):
    """
    최근 로그 조회

    Args:
        limit: 조회할 로그 개수
        type_filter: 타입 필터 (예: "ai_analyze")

    Returns:
        로그 목록
    """
    try:
        conn = get_conn()
        cur = conn.cursor()

        if type_filter:
            cur.execute("""
                SELECT id, type, title, details, ts, branch
                FROM logs
                WHERE type = ?
                ORDER BY ts DESC
                LIMIT ?
            """, (type_filter, limit))
        else:
            cur.execute("""
                SELECT id, type, title, details, ts, branch
                FROM logs
                ORDER BY ts DESC
                LIMIT ?
            """, (limit,))

        rows = cur.fetchall()
        conn.close()

        return [
            {
                "id": row[0],
                "type": row[1],
                "title": row[2],
                "details": json.loads(row[3]) if row[3] else None,
                "ts": row[4],
                "branch": row[5]
            }
            for row in rows
        ]

    except Exception as e:
        print(f"[ERROR] Failed to get logs: {e}")
        return []


# 테스트용
if __name__ == "__main__":
    # 테스트 로그 추가
    log_id = add_log_entry(
        type="test",
        title="Test Log Entry",
        details='{"message": "테스트 로그입니다"}'
    )

    print(f"✅ 로그 추가됨: ID={log_id}")

    # 최근 로그 조회
    recent = get_recent_logs(limit=5)
    print(f"\n📋 최근 로그 {len(recent)}개:")
    for log in recent:
        print(f"  - [{log['type']}] {log['title']}")
