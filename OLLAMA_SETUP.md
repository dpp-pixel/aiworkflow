# 🤖 Ollama 내부 AI 설정 가이드

## 📋 현재 상태

✅ Ollama 설치 완료
🔄 모델 다운로드 필요
⏳ 테스트 대기 중

---

## 1️⃣ 모델 다운로드 (PowerShell/CMD)

```powershell
# 코드 분석용 모델 다운로드 (약 4.7GB, 5-10분 소요)
ollama pull qwen2.5-coder:7b
```

**다운로드 진행 상황:**
```
pulling manifest
pulling 8a4de2b7569a... 100% ▕████████████████▏ 4.7 GB
pulling 96fe74d55276... 100% ▕████████████████▏  106 B
pulling d7cae4d77c85... 100% ▕████████████████▏  11 KB
verifying sha256 digest
writing manifest
success
```

---

## 2️⃣ 기본 동작 확인

```powershell
# 간단한 테스트
ollama run qwen2.5-coder:7b "안녕하세요"
```

**예상 출력:**
```
안녕하세요! 무엇을 도와드릴까요?
```

✅ 한글이 정상적으로 출력되면 성공!

---

## 3️⃣ Python 테스트 실행

```bash
# my_project 폴더에서 실행
cd C:\Users\82104\my_project
python test_ollama_integration.py
```

**예상 결과:**
```
🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀
🚀 Ollama 통합 테스트 시작
🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀

============================================================
🧪 테스트 1: 기본 메서드 분석
============================================================
✅ 분석 성공!
⏱️  실행 시간: 2.3초

📊 분석 결과:
{
  "method_name": "resetPassword",
  "purpose": "사용자 이메일로 비밀번호 재설정...",
  "complexity": 4,
  "externals": ["userRepository", "tokenGenerator", ...]
}
```

---

## 4️⃣ API 테스트 (서버 실행)

### 서버 시작:
```bash
cd C:\Users\82104\my_project
python app.py
```

### 다른 터미널에서 API 호출:
```bash
curl -X POST http://localhost:8001/main/ai/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "code": "public void parse(String s) { tokens.add(s); }",
    "method_name": "parse"
  }'
```

**예상 응답:**
```json
{
  "ok": true,
  "data": {
    "method_name": "parse",
    "purpose": "문자열을 토큰 컬렉션에 추가하는 기능",
    "complexity": 2,
    "externals": ["tokens"]
  },
  "duration": 2.1,
  "model": "qwen2.5-coder:7b",
  "log_id": 42
}
```

---

## 📁 생성된 파일들

```
my_project/
├── main/
│   └── analyze_runner.py          ✅ Ollama 분석 모듈
├── logs/
│   └── utils.py                   ✅ 로그 저장 유틸리티
├── test_ollama_integration.py     ✅ 통합 테스트 스크립트
└── OLLAMA_SETUP.md               ✅ 이 가이드
```

---

## 🔧 트러블슈팅

### ❌ "ollama: command not found"
**해결:** 새 터미널을 열어서 다시 시도

### ❌ "model not found"
**해결:**
```bash
ollama pull qwen2.5-coder:7b
```

### ❌ "Timeout after 30 seconds"
**원인:** 모델이 너무 크거나 PC 사양 부족
**해결:**
```bash
# 더 작은 모델 사용
ollama pull qwen2.5-coder:3b
```

### ❌ JSON 파싱 에러
**원인:** 모델이 JSON 외 텍스트 추가
**해결:** 이미 코드에서 처리됨 (re.search로 JSON만 추출)

---

## 📊 모델 비교

| 모델 | 크기 | 속도 | 한글 품질 | 정확도 |
|------|------|------|----------|--------|
| `qwen2.5-coder:7b` | 4.7GB | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| `qwen2.5-coder:3b` | 1.9GB | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| `deepseek-coder-v2:16b` | 8.9GB | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

**추천:** `qwen2.5-coder:7b` (현재 설정)

---

## 🎯 다음 단계

1. ✅ Ollama 설치
2. 🔄 모델 다운로드 ← **지금 여기!**
3. ⏳ Python 테스트
4. ⏳ API 테스트
5. ⏳ 프론트엔드 연동

---

**문제가 있으면 알려주세요!** 🚀
