#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
빠른 Ollama 테스트
"""
import subprocess
import json

print("="*60)
print("🧪 Ollama 빠른 테스트")
print("="*60)

# 테스트 1: Ollama 실행 가능 여부
print("\n[1/3] Ollama 명령어 확인 중...")
try:
    result = subprocess.run(
        ["ollama", "--version"],
        capture_output=True,
        text=True,
        timeout=5
    )
    if result.returncode == 0:
        print(f"✅ Ollama 설치됨: {result.stdout.strip()}")
    else:
        print(f"❌ Ollama 실행 실패")
        exit(1)
except Exception as e:
    print(f"❌ 오류: {e}")
    exit(1)

# 테스트 2: 모델 확인
print("\n[2/3] 모델 확인 중...")
try:
    result = subprocess.run(
        ["ollama", "list"],
        capture_output=True,
        text=True,
        timeout=5
    )
    if "qwen2.5-coder" in result.stdout:
        print("✅ qwen2.5-coder:7b 모델 있음")
    else:
        print("❌ 모델 없음. 다운로드 필요:")
        print("   ollama pull qwen2.5-coder:7b")
        exit(1)
except Exception as e:
    print(f"❌ 오류: {e}")
    exit(1)

# 테스트 3: 실제 분석 테스트
print("\n[3/3] 코드 분석 테스트 중...")
print("⏳ 약 2-3초 소요됩니다...\n")

test_code = """
public void resetPassword(String email) {
    User user = userRepository.findByEmail(email);
    String token = tokenGenerator.generate();
    emailService.sendResetEmail(user, token);
}
"""

prompt = f"""다음 Java 메서드를 분석하고 JSON만 출력해. 다른 설명은 하지 마.

형식:
{{
  "method_name": "메서드명",
  "purpose": "한글로 설명",
  "complexity": 1-10 숫자,
  "externals": ["의존성"]
}}

코드:
{test_code}
"""

try:
    result = subprocess.run(
        ["ollama", "run", "qwen2.5-coder:7b", prompt],
        capture_output=True,
        text=True,
        timeout=30,
        encoding='utf-8'
    )

    if result.returncode == 0:
        output = result.stdout.strip()
        print("📄 Ollama 출력:")
        print("-" * 60)
        print(output)
        print("-" * 60)

        # JSON 추출 시도
        import re
        json_match = re.search(r'\{.*\}', output, re.DOTALL)

        if json_match:
            try:
                data = json.loads(json_match.group(0))
                print("\n✅ JSON 파싱 성공!")
                print(json.dumps(data, indent=2, ensure_ascii=False))

                # 필드 확인
                required = ["method_name", "purpose", "complexity", "externals"]
                missing = [f for f in required if f not in data]

                if missing:
                    print(f"\n⚠️  누락된 필드: {missing}")
                else:
                    print("\n🎉 모든 테스트 통과!")
                    print(f"   - 메서드명: {data['method_name']}")
                    print(f"   - 복잡도: {data['complexity']}/10")
                    print(f"   - 의존성: {len(data['externals'])}개")

            except json.JSONDecodeError as e:
                print(f"\n❌ JSON 파싱 실패: {e}")
                exit(1)
        else:
            print("\n❌ JSON을 찾을 수 없음")
            exit(1)
    else:
        print(f"❌ 실행 실패: {result.stderr}")
        exit(1)

except subprocess.TimeoutExpired:
    print("❌ 타임아웃 (30초 초과)")
    exit(1)
except Exception as e:
    print(f"❌ 오류: {e}")
    exit(1)

print("\n" + "="*60)
print("✅ Ollama 통합 준비 완료!")
print("="*60)
