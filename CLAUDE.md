# Claude Code Instructions — aiworkflow (my_project)

## 프로젝트 개요
**Java 코드 분석 & AI 편집 웹 플랫폼** ("바이브 코딩 가속")
FastAPI 백엔드 + React 프론트엔드. 로컬 Ollama AI 또는 외부 AI 서버와 연동.
데스크톱 앱 형식 (pywebview) 으로 실행.

---

## 프로젝트 구조

```
my_project/
├── app.py                   # FastAPI 메인 앱 (포트 8001)
├── desktop.py               # pywebview 데스크톱 런처
├── start.bat                # Windows 실행 스크립트
├── main/
│   ├── routes.py            # 전체 API 엔드포인트
│   ├── java_indexer.py      # Java 파일 파싱 (패키지/클래스/메서드/필드)
│   ├── anchor_utils/        # 앵커 ID 생성 시스템
│   │   ├── __init__.py      # pkg/cls/field/method 앵커 + normalize_method_signature
│   │   ├── ui_anchor.py     # UI 표시용 앵커 (Parser.parse(String))
│   │   └── ai_anchor.py     # AI 내부용 앵커 (m:com.example.Parser.parse(String))
│   ├── compare_utils.py     # working/ckpt/dir 상태 비교
│   ├── checkpoint_utils.py  # 체크포인트 스냅샷 저장/복원
│   ├── patch_utils.py       # Unified diff 패치 적용
│   ├── diagnostic_utils.py  # javac 컴파일 + gradle 테스트
│   ├── graph_utils.py       # 클래스/패키지 관계 그래프
│   ├── analyze_runner.py    # Ollama AI 분석 (qwen2.5-coder:7b)
│   ├── event_bus.py         # SSE 이벤트 버스
│   └── watcher.py           # 파일 변경 감시
└── frontend/
    └── src/components/
        ├── MainPanel.jsx    # 패키지/클래스/메서드 계층 시각화 (~1400줄)
        ├── GraphView.jsx    # D3 기반 클래스 관계 그래프
        ├── ContextPanel.jsx # MD 파일 업로드/관리
        ├── AiEditModal.jsx  # AI 편집 제안 모달
        └── DiagnosePanel.jsx # 컴파일/테스트 진단 패널
```

---

## 실행 방법

```bash
# 데스크톱 앱 실행 (권장)
start.bat          # frontend npm dev + py desktop.py 동시 실행

# 수동 실행
py desktop.py      # pywebview 창 (http://127.0.0.1:8001 내장)
cd frontend && npm run dev  # Vite dev 서버 (포트 5173)
```

---

## 개발 환경
- **OS**: Windows 11
- **Backend**: Python / FastAPI (포트 8001)
- **Frontend**: React + Vite (포트 5173)
- **Desktop**: pywebview (네이티브 창)
- **AI**: Ollama (qwen2.5-coder:7b) / 외부 AI 서버

---

## AI 행동 지침 (LLM 코딩 실수 방지)

> 이 지침은 속도보다 신중함을 우선합니다. 사소한 작업은 판단에 따라 조정하세요.

### 1. 코딩 전에 생각하라
- 가정하지 말 것. 혼란을 숨기지 말 것. 트레이드오프를 드러낼 것.
- 구현 전: 가정을 명시적으로 서술하고, 불확실하면 질문하라.
- 해석이 여러 가지라면 모두 제시하라 — 조용히 선택하지 말 것.
- 더 단순한 방법이 있으면 먼저 말하라.
- 무언가 불명확하면 멈추고, 무엇이 헷갈리는지 이름 붙여 물어보라.

### 2. 단순함 우선
- 문제를 푸는 최소한의 코드만 작성.
- 요청하지 않은 기능, 추상화, 유연성, 설정 가능성 추가 금지.
- 불가능한 시나리오에 대한 에러 핸들링 추가 금지.
- 200줄로 쓴 것이 50줄로 가능하다면 다시 쓰라.
- "시니어 엔지니어가 과도하게 복잡하다고 할까?" — 그렇다면 단순화하라.

### 3. 외과적 변경
- 반드시 필요한 것만 수정할 것.
- 인접한 코드, 주석, 포매팅을 "개선"하지 말 것.
- 망가지지 않은 것은 리팩토링하지 말 것.
- 기존 스타일을 따를 것 (개인 선호와 달라도).
- 관련 없는 데드코드 발견 시 → 언급만 하고 삭제하지 말 것.
- 내 변경으로 생긴 고아(import/변수/함수)는 내가 정리할 것.
- **기준**: 변경된 모든 줄이 사용자의 요청으로 직접 추적 가능해야 한다.

### 4. 목표 기반 실행
- 성공 기준을 정의하고 검증될 때까지 반복하라.
- 작업을 검증 가능한 목표로 변환:
  - "유효성 검사 추가" → "잘못된 입력 테스트 작성, 통과시키기"
  - "버그 수정" → "버그 재현 테스트 작성, 통과시키기"
- 다단계 작업은 계획을 먼저 서술: `[단계] → 검증: [확인 방법]`
- 명확한 성공 기준 = 독립적으로 루프 실행 가능. 모호한 기준 = 계속 질문 필요.

---

## 코딩 규칙

### 일반
- 명확성과 가독성 우선
- 주석은 "왜"를 설명 (무엇을 하는지는 코드로)
- 함수는 단일 책임 원칙(SRP)
- 의미 있는 변수명과 함수명

### 백엔드 (Python/FastAPI)
- 런타임 상태는 `app.state`에 보관 (`app.state.last_index` 등)
- 워크스페이스 경로는 항상 `ensure_workspace()` 통해 가져오기
- 앵커 ID 형식: `pkg:`, `cls:`, `m:`, `f:` 접두사 사용

### 프론트엔드 (React)
- 컴포넌트 상태는 최소화, 필요한 것만 state로
- SSE 연결: `/main/events` 엔드포인트 사용
- 색상 팔레트: `#10b981` (초록/public), `#f59e0b` (주황/protected), `#6b7280` (회색/private), `#60a5fa` (파랑/package)

### 파일 관리
- 임시 파일은 `.gitignore`에 추가
- 민감한 정보는 `.env` 사용 (절대 커밋 금지)

---

## 주요 API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| POST | `/workspace/set` | 워크스페이스 경로 설정 |
| GET | `/workspace/browse` | 서버 파일시스템 탐색 (폴더 선택기) |
| GET | `/main/events` | SSE 이벤트 스트림 |
| POST | `/main/layout/basic` | Java 인덱스 빌드 |
| GET | `/main/method` | 메서드 본문 조회 (`?nodeId=m:...`) |
| GET | `/main/checkpoints` | 체크포인트 목록 |
| GET | `/files` | 워크스페이스 파일 목록 |
| GET | `/context/recipes` | 컨텍스트 레시피 목록 |
| GET | `/settings` | 설정 조회 |

---

## Git

```bash
git status
git add -p              # 변경사항 선택적 스테이징
git commit -m "message"
git push origin actc3   # 현재 브랜치
```

- **Remote**: `https://github.com/dpp-pixel/aiworkflow`
- **Main branch**: `main`
- **작업 branch**: `actc3`

---

## 주의사항

### 보안
- API 키 절대 하드코딩 금지 → `.env` 사용
- `OLLAMA_URL`, `EXTERNAL_AI_URL`, `EXTERNAL_AI_KEY` 환경변수 사용

### 알려진 이슈 / 주의점
- `app.state.last_index` 캐시: `/main/layout/basic` POST 후 갱신됨. 워크스페이스 변경 시 반드시 재인덱스 필요
- Java 인덱서: `build/`, `out/`, `bin/`, `target/` 디렉토리는 자동 제외
- `anchor_utils/ui_anchor.py`, `ai_anchor.py` 는 생성했으나 아직 routes/frontend에 완전히 연결 안 됨

---

## HANDOFF 규칙

`HANDOFF.md` 업데이트 시 **AI QUICK START 섹션을 최우선으로 업데이트** (10줄 이내).

**포함 내용:**
- 📍 현재 작업 (한 줄 + 주요 파일 경로:라인번호)
- ⚡ 다음 할 일 (우선순위 순)
- ⚠️ 블로커/주의사항
- 🚫 절대 규칙
- 💡 한 줄 요약 (15자 이내)

---

**마지막 업데이트**: 2026-05-20
