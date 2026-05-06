# 작업 인수인계 - Handoff Document

> **프로젝트**: aiworkflow (Java 코드 분석 & AI 편집 플랫폼)
> **마지막 업데이트**: 2026-05-05 (로그 패널 + 오버레이 완성 세션)
> **브랜치**: `actc3` → `https://github.com/dpp-pixel/aiworkflow`

---

## 🚀 AI QUICK START (READ THIS FIRST!)

### 📍 현재 작업
- 로그 패널 구현 완료, 오버레이(baseline 비교) 시각화 완성
- 주요 파일: `frontend/src/components/MainPanel.jsx`, `frontend/src/components/LogPanel.jsx`, `logs/routes.py`, `main/compare_utils.py`
- 상태: 미커밋 변경 있음 (`app.py`, `frontend/` 등)

### ⚡ 다음 할 일 (우선순위 순)
1. 외부 AI 콜백 플로우 완성 (`EXTERNAL_AI_URL` / `EXTERNAL_AI_KEY` 실제 동작 검증)
2. 그래프 뷰 고도화 (Force-directed 클러스터, Path Finder)
3. 컨텍스트 패널 완성 (섹션 해시 검증, Secret Scan 동의)

### ⚠️ 블로커/주의사항
- 오버레이 비교: `compare_states(baseline_id, "working")` 결과를 `data.overlay.changes` (배열)로 받음
- 체크포인트 blob이 실제 파일 SHA와 다를 수 있음 — 테스트 데이터 주입 흔적 있음 (`ckpt_20260101_090000_test` blobs 수정됨)
- `LogPanel`은 `#logRoot` div에 별도 React 루트로 마운트 (`log.jsx`)

### 🚫 절대 규칙
- `app.state.last_index` 직접 수정 금지 — `/main/layout/basic` POST 통해서만 갱신
- `.env` 파일 절대 커밋 금지 (AI 키 포함)
- `start.bat`을 브라우저 방식으로 되돌리지 말 것 (pywebview 방식 유지)

### 💡 한 줄 요약
👉 **"로그패널+오버레이 완성"**

---

## 완료된 작업 ✅

### 로그 패널 + 오버레이 시각화 (2026-05-05)
- **관련 파일**: `frontend/src/components/LogPanel.jsx`, `frontend/src/log.jsx`, `logs/routes.py`, `logs/utils.py`, `main/compare_utils.py`, `main/watcher.py`, `app.py`
- **변경사항**:
  - `LogPanel` — 체크포인트 타임라인 + 파일 이벤트 목록 UI. `#logRoot`에 별도 React 루트로 마운트
  - `logs/routes.py` — `GET /logs/timeline` (체크포인트 + 파일 이벤트 병합), `GET /logs/checkpoints`
  - `compare_utils.py` — `compare_states(from, to)` → `{changes: [{anchor, kind, locDelta, ranges}]}` 배열
  - 오버레이: baseline 클릭 시 `baseline-changed` 커스텀 이벤트 → `App.jsx` → `MainPanel.jsx`
  - MethodRow: dot은 접근자 색 유지, overlay는 왼쪽 border stripe(teal/purple/red)로 표시
  - Ghost 메서드: checkpoint에 있고 working에 없는 메서드 → 트리에 회색 ghost로 표시

### 수정 모드 stub 기능 제거 (2026-05-05)
- **관련 파일**: `frontend/src/components/MainPanel.jsx`
- **제거**: `batchSubmitting`, `buildBatchPayload`, `handleBatchApply`, `clearSelection`, "ZIP 내보내기", "일괄 적용", "되돌리기" 버튼

### ui_anchor / ai_anchor 정규화 버그 수정 (2026-05-05)
- **관련 파일**: `main/anchor_utils/ui_anchor.py`, `main/anchor_utils/ai_anchor.py`
- **버그**: 정규식이 return type과 method name을 한꺼번에 제거 → 메서드명 소실
- **수정**: `re.match`로 ReturnType / methodName 명확히 분리



### 워크스페이스 폴더 선택기
- **완료일**: 2026-04-29
- **설명**: 브라우저 모드에서 서버 파일시스템 탐색 폴더 선택 모달 구현
- **관련 파일**:
  - `app.py` — `/workspace/browse` GET 엔드포인트 추가
  - `frontend/index.html` — `window.openFolderPicker` 모달 UI
- **변경사항**: `window.prompt()` 대신 서버사이드 파일시스템 탐색 UI

### pywebview 데스크톱 앱 모드
- **완료일**: 2026-04-29
- **설명**: `start.bat`이 브라우저 대신 pywebview 네이티브 창으로 앱 실행
- **관련 파일**:
  - `desktop.py` — uvicorn + pywebview 런처
  - `start.bat` — frontend dev + `py desktop.py` 포그라운드 실행

### 메서드 본문 조회 버그 수정
- **완료일**: 2026-04-29
- **설명**: 메서드 자세히 보기 시 "not found" 또는 부실한 내용 표시 버그 수정
- **관련 파일**:
  - `main/routes.py` — `get_method` 엔드포인트 재작성 (`app.state.last_index` 캐시 활용)
  - `main/java_indexer.py` — `range.start`를 시그니처 시작 줄로 수정
- **변경사항**: 함수 속성(`_workspace`) 대신 `app.state.last_index` 캐시로 워크스페이스 조회

### anchor_utils 패키지 리팩터링
- **완료일**: 2026-04-29
- **설명**: 단일 `anchor_utils.py` → `anchor_utils/` 패키지로 분리
- **관련 파일**:
  - `main/anchor_utils/__init__.py` — 기존 앵커 함수 + normalize_method_signature
  - `main/anchor_utils/ui_anchor.py` — UI용 앵커 (사람이 보기 좋은 형식)
  - `main/anchor_utils/ai_anchor.py` — AI 내부용 앵커 (FQCN 형식)
- **주의**: `ui_anchor`, `ai_anchor`는 생성됐으나 아직 실제 연결 미완

### java_indexer 개선
- **완료일**: 2026-04-29
- **설명**: 클래스 범위 정확도 향상, 로컬 변수 필드 오인 버그 수정
- **관련 파일**: `main/java_indexer.py`
- **변경사항**:
  - `_find_class_block_end()` — 중괄호 매칭으로 정확한 클래스 범위
  - `_mask_method_bodies()` — 메서드 본문 마스킹 (로컬 변수 제외)
  - `_extract_visibility()` — 접근자 추출 (public/protected/private/package)
  - 메서드 요약에 `visibility`, `static` 필드 추가

### 프로젝트 문서화 (CLAUDE.md / HANDOFF.md)
- **완료일**: 2026-04-29
- **설명**: 프로젝트 전용 `CLAUDE.md`, `HANDOFF.md` 신규 생성 (홈 폴더 템플릿 기반)
- **관련 파일**:
  - `CLAUDE.md` — 프로젝트 구조, 실행 방법, API 엔드포인트, 코딩 규칙
  - `HANDOFF.md` — 현재 상태, 완료 작업, 다음 우선순위
- **변경사항**: 다음 세션부터 Claude Code가 자동으로 프로젝트 컨텍스트 로드

### MainPanel 시각화 개선 3종
- **완료일**: 2026-04-29
- **관련 파일**: `frontend/src/components/MainPanel.jsx`
- **변경사항**:
  1. **접근자 색상 구분 + 필터 검색** — public(초록), protected(주황), private(회색), package(파랑)
  2. **Java 신택스 하이라이팅** — 확장 코드뷰에 순수 정규식 토크나이저 적용
  3. **클래스 접기/펼치기 + LOC 히트맵** — 클래스 헤더 클릭으로 토글, 메서드 행 배경색으로 LOC 시각화

---

## 진행 중인 작업 🔄

없음. 다음 우선순위 참조.

---

## 다음 작업 예정 📋

### 우선순위 1 (핵심 기능)
- [x] `ui_anchor` / `ai_anchor` 실제 연결 — `java_indexer.py`에서 `uiLabel`, `aiId` 필드로 포함됨
- [x] 로그 패널 구현 — 완료

### 우선순위 2 (AI 연동)
- [ ] 외부 AI 콜백 플로우 완성 — `EXTERNAL_AI_URL` / `EXTERNAL_AI_KEY` 실제 동작 검증
- [ ] AI 분석 결과 MainPanel 연동 — `analyze_runner.py` 결과를 UI에 표시

### 우선순위 3 (고도화)
- [ ] 그래프 뷰 고도화 — Force-directed 클러스터, Path Finder, LOD
- [ ] 컨텍스트 패널 완성 — 섹션 해시 검증, Secret Scan 동의 플로우

---

## 중요 사항 ⚠️

### 환경 설정
- `.env` 파일에 AI 키 설정 필요 (커밋 금지)
- `OLLAMA_URL` (기본: `http://localhost:11434`)
- `EXTERNAL_AI_URL`, `EXTERNAL_AI_KEY` (외부 AI 서버)

### 알려진 이슈
1. **인덱스 캐시 미동기화**: 워크스페이스 파일 수동 변경 시 자동 재인덱스 안 됨 → "새로고침" 버튼 필요
2. **anchor_utils 미연결**: `ui_anchor.py`, `ai_anchor.py` 구현은 됐으나 실제 호출 없음

### 개발 환경
- Python 3.11, FastAPI, uvicorn, pywebview
- Node.js, React, Vite
- Ollama (로컬 AI 서버)

---

## 최근 커밋

```
4aa4d91 feat: 클래스 접기/펼치기 + LOC 히트맵 추가
4bbe75d refactor: 코드뷰 복사 버튼 제거
173fcd5 feat: 확장 코드뷰 신택스 하이라이팅 추가
62d1070 feat: 메서드 접근자 색상 구분 + 필터 검색창 추가
e282f5d fix: 메서드 본문 조회 버그 수정 + start.bat pywebview 방식으로 변경
```

---

## 유용한 명령어

```bash
# 실행
start.bat                        # 전체 앱 실행

# Git
git status
git log --oneline -10
git push origin actc3

# 개발
cd frontend && npm run dev        # 프론트엔드만
py -m uvicorn app:app --reload --port 8001  # 백엔드만
```

---

**💡 팁**: 작업 시작 전 `CLAUDE.md`의 API 엔드포인트 표와 주의사항 섹션을 확인하세요.
