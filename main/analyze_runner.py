# main/analyze_runner.py
"""
Ollama CLI 기반 코드 분석 모듈
"""
import subprocess
import json
import re
import time
from typing import Dict, Any, Optional


def run_ollama_analyze(
    code: str,
    model: str = "qwen2.5-coder:7b",
    timeout: int = 30
) -> Dict[str, Any]:
    """
    Ollama를 사용하여 Java 메서드 분석

    Args:
        code: 분석할 Java 코드
        model: 사용할 Ollama 모델
        timeout: 타임아웃 (초)

    Returns:
        {
            "ok": bool,
            "data": {
                "method_name": str,
                "purpose": str,
                "complexity": int,
                "externals": [str]
            },
            "duration": float,
            "error": str (실패 시)
        }
    """
    prompt = f"""다음 Java 메서드를 분석하고 JSON만 출력해줘. 다른 설명은 하지 마.

형식:
{{
  "method_name": "메서드명",
  "purpose": "한글로 기능 설명 (1-2문장)",
  "complexity": 1-10 사이 숫자,
  "externals": ["외부 의존성 목록"]
}}

코드:
{code}
"""

    start = time.time()

    try:
        result = subprocess.run(
            ["ollama", "run", model, prompt],
            capture_output=True,
            text=True,
            timeout=timeout,
            encoding='utf-8'
        )

        duration = round(time.time() - start, 2)

        if result.returncode != 0:
            return {
                "ok": False,
                "error": result.stderr.strip() or "Unknown error",
                "duration": duration
            }

        # JSON 추출
        output = result.stdout.strip()

        # 출력에서 JSON 부분만 추출
        json_match = re.search(r'\{.*\}', output, re.DOTALL)

        if not json_match:
            return {
                "ok": False,
                "error": "No JSON found in output",
                "raw": output[:500],  # 처음 500자만 저장
                "duration": duration
            }

        # JSON 파싱
        json_str = json_match.group(0)
        data = json.loads(json_str)

        # 필수 필드 검증
        required_fields = ["method_name", "purpose", "complexity", "externals"]
        missing = [f for f in required_fields if f not in data]

        if missing:
            return {
                "ok": False,
                "error": f"Missing required fields: {', '.join(missing)}",
                "data": data,
                "duration": duration
            }

        # 타입 검증
        if not isinstance(data["complexity"], int):
            try:
                data["complexity"] = int(data["complexity"])
            except (ValueError, TypeError):
                data["complexity"] = 5  # 기본값

        if not isinstance(data["externals"], list):
            data["externals"] = []

        return {
            "ok": True,
            "data": data,
            "duration": duration,
            "model": model
        }

    except subprocess.TimeoutExpired:
        return {
            "ok": False,
            "error": f"Timeout after {timeout} seconds",
            "duration": timeout
        }
    except json.JSONDecodeError as e:
        return {
            "ok": False,
            "error": f"JSON decode error: {str(e)}",
            "raw": json_str[:500] if 'json_str' in locals() else output[:500],
            "duration": time.time() - start
        }
    except Exception as e:
        return {
            "ok": False,
            "error": f"Unexpected error: {str(e)}",
            "duration": time.time() - start
        }


def analyze_class(
    class_code: str,
    model: str = "qwen2.5-coder:7b"
) -> Dict[str, Any]:
    """
    클래스 전체 분석

    Args:
        class_code: 클래스 코드
        model: 사용할 모델

    Returns:
        분석 결과
    """
    prompt = f"""다음 Java 클래스를 분석하고 JSON만 출력해줘.

형식:
{{
  "class_name": "클래스명",
  "purpose": "클래스 목적 (한글)",
  "responsibilities": ["책임1", "책임2"],
  "complexity": 1-10
}}

코드:
{class_code}
"""

    start = time.time()

    try:
        result = subprocess.run(
            ["ollama", "run", model, prompt],
            capture_output=True,
            text=True,
            timeout=40,
            encoding='utf-8'
        )

        duration = round(time.time() - start, 2)

        if result.returncode != 0:
            return {"ok": False, "error": result.stderr, "duration": duration}

        output = result.stdout.strip()
        json_match = re.search(r'\{.*\}', output, re.DOTALL)

        if not json_match:
            return {"ok": False, "error": "No JSON found", "duration": duration}

        data = json.loads(json_match.group(0))

        return {
            "ok": True,
            "data": data,
            "duration": duration,
            "model": model
        }

    except Exception as e:
        return {
            "ok": False,
            "error": str(e),
            "duration": time.time() - start
        }


# 테스트용
if __name__ == "__main__":
    test_code = """
    public void resetPassword(String email) {
        User user = userRepository.findByEmail(email);
        String token = tokenGenerator.generate();
        emailService.sendResetEmail(user, token);
        tokenRepository.save(token, user.getId());
    }
    """

    print("🧪 Ollama 분석 테스트...")
    result = run_ollama_analyze(test_code)

    if result['ok']:
        print("\n✅ 성공!")
        print(json.dumps(result['data'], indent=2, ensure_ascii=False))
        print(f"\n⏱️  실행 시간: {result['duration']}초")
    else:
        print("\n❌ 실패!")
        print(f"에러: {result['error']}")
        if 'raw' in result:
            print(f"원본 출력: {result['raw']}")
