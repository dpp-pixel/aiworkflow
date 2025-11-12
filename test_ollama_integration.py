#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Ollama 통합 테스트 스크립트
"""
import sys
import json
import time
from pathlib import Path

# 프로젝트 루트를 경로에 추가
sys.path.insert(0, str(Path(__file__).parent))

from main.analyze_runner import run_ollama_analyze, analyze_class
from logs.utils import log_ai_analysis, get_recent_logs


def test_1_basic_analyze():
    """
    테스트 1: 기본 메서드 분석
    """
    print("\n" + "="*60)
    print("🧪 테스트 1: 기본 메서드 분석")
    print("="*60)

    test_code = """
    public void resetPassword(String email) {
        User user = userRepository.findByEmail(email);
        String token = tokenGenerator.generate();
        emailService.sendResetEmail(user, token);
        tokenRepository.save(token, user.getId());
    }
    """

    print("📝 분석할 코드:")
    print(test_code)
    print("\n⏳ Ollama 분석 중...")

    result = run_ollama_analyze(test_code)

    if result['ok']:
        print("\n✅ 분석 성공!")
        print(f"⏱️  실행 시간: {result['duration']}초")
        print(f"🤖 모델: {result.get('model')}")
        print("\n📊 분석 결과:")
        print(json.dumps(result['data'], indent=2, ensure_ascii=False))
        return True
    else:
        print("\n❌ 분석 실패!")
        print(f"에러: {result.get('error')}")
        if 'raw' in result:
            print(f"원본 출력: {result['raw'][:200]}...")
        return False


def test_2_complex_method():
    """
    테스트 2: 복잡한 메서드 분석
    """
    print("\n" + "="*60)
    print("🧪 테스트 2: 복잡한 메서드 분석")
    print("="*60)

    test_code = """
    public void processOrder(Order order) {
        if (order == null || !order.isValid()) {
            throw new InvalidOrderException("Order is invalid");
        }

        if (order.isPaid()) {
            if (inventory.hasStock(order.getItems())) {
                inventory.reduce(order.getItems());
                shipping.schedule(order);
                email.sendConfirmation(order.getCustomer());
                metrics.recordSuccess(order.getId());
            } else {
                order.cancel();
                refund.process(order);
                email.sendStockAlert(order.getCustomer());
            }
        } else {
            payment.requestPayment(order);
        }
    }
    """

    print("📝 분석할 코드: (복잡한 비즈니스 로직)")
    print(test_code[:200] + "...")

    result = run_ollama_analyze(test_code)

    if result['ok']:
        print("\n✅ 분석 성공!")
        print(f"복잡도: {result['data']['complexity']}/10")
        print(f"목적: {result['data']['purpose']}")
        print(f"의존성 개수: {len(result['data']['externals'])}")
        return True
    else:
        print(f"\n❌ 실패: {result.get('error')}")
        return False


def test_3_class_analyze():
    """
    테스트 3: 클래스 전체 분석
    """
    print("\n" + "="*60)
    print("🧪 테스트 3: 클래스 분석")
    print("="*60)

    test_code = """
    public class UserService {
        private UserRepository userRepository;
        private EmailService emailService;

        public User findUser(String email) {
            return userRepository.findByEmail(email);
        }

        public void resetPassword(String email) {
            User user = findUser(email);
            String token = generateToken();
            emailService.sendResetEmail(user, token);
        }
    }
    """

    print("📝 분석할 클래스: UserService")

    result = analyze_class(test_code)

    if result['ok']:
        print("\n✅ 클래스 분석 성공!")
        print(json.dumps(result['data'], indent=2, ensure_ascii=False))
        return True
    else:
        print(f"\n❌ 실패: {result.get('error')}")
        return False


def test_4_log_integration():
    """
    테스트 4: 로그 연동 테스트
    """
    print("\n" + "="*60)
    print("🧪 테스트 4: 로그 연동")
    print("="*60)

    test_code = """
    public String getName() {
        return this.name;
    }
    """

    result = run_ollama_analyze(test_code)

    if result['ok']:
        # 로그에 저장
        log_id = log_ai_analysis(
            method_name="getName",
            result=result,
            code_snippet=test_code
        )

        print(f"✅ 로그 저장 성공! ID={log_id}")

        # 최근 로그 조회
        recent_logs = get_recent_logs(limit=3, type_filter="ai_analyze")

        print(f"\n📋 최근 AI 분석 로그 {len(recent_logs)}개:")
        for log in recent_logs:
            print(f"  - {log['title']} (ID: {log['id']})")
            if log['details']:
                complexity = log['details'].get('complexity', 'N/A')
                print(f"    복잡도: {complexity}")

        return True
    else:
        print(f"❌ 실패: {result.get('error')}")
        return False


def test_5_performance():
    """
    테스트 5: 성능 테스트 (여러 메서드 연속 분석)
    """
    print("\n" + "="*60)
    print("🧪 테스트 5: 성능 테스트 (3개 메서드)")
    print("="*60)

    test_methods = [
        "public String getName() { return name; }",
        "public void setName(String n) { this.name = n; }",
        "public boolean isValid() { return name != null && !name.isEmpty(); }"
    ]

    durations = []

    for i, code in enumerate(test_methods, 1):
        print(f"\n[{i}/3] 분석 중...")
        result = run_ollama_analyze(code)

        if result['ok']:
            durations.append(result['duration'])
            print(f"  ✅ 완료 ({result['duration']}초)")
        else:
            print(f"  ❌ 실패: {result.get('error')}")

    if durations:
        avg = sum(durations) / len(durations)
        print(f"\n📊 평균 실행 시간: {avg:.2f}초")
        print(f"📊 최소: {min(durations):.2f}초, 최대: {max(durations):.2f}초")
        return True
    else:
        return False


def main():
    """
    전체 테스트 실행
    """
    print("\n" + "🚀"*30)
    print("🚀 Ollama 통합 테스트 시작")
    print("🚀"*30)

    tests = [
        ("기본 분석", test_1_basic_analyze),
        ("복잡한 메서드", test_2_complex_method),
        ("클래스 분석", test_3_class_analyze),
        ("로그 연동", test_4_log_integration),
        ("성능 테스트", test_5_performance),
    ]

    results = []

    for name, test_func in tests:
        try:
            success = test_func()
            results.append((name, success))
            time.sleep(0.5)  # 잠깐 대기
        except Exception as e:
            print(f"\n💥 예외 발생: {e}")
            results.append((name, False))

    # 결과 요약
    print("\n" + "="*60)
    print("📊 테스트 결과 요약")
    print("="*60)

    passed = sum(1 for _, success in results if success)
    total = len(results)

    for name, success in results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} | {name}")

    print(f"\n총 {passed}/{total} 테스트 통과")

    if passed == total:
        print("\n🎉 모든 테스트 통과! Ollama 통합 성공!")
    else:
        print(f"\n⚠️  {total - passed}개 테스트 실패")

    return passed == total


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
