# 작업 인수인계 - Handoff Document

> **프로젝트**: aiworkflow (Java 코드 분석 & AI 편집 플랫폼)
> **마지막 업데이트**: 2026-05-07 (Context Panel 전면 개선 세션)
> **브랜치**: `actc3` → `https://github.com/dpp-pixel/aiworkflow`

---

## 🚀 AI QUICK START (READ THIS FIRST!)

### 📍 현재 작업
- Context Panel Phase 1~3 완료
- 주요 파일: `frontend/src/components/ContextPanel.jsx`, `context/routes.py`, `context/utils.py`
- 상태: 커밋 완료

### ⚡ 다음 할 일 (우선순위 순)
1. 외부 AI 콜백 플로우 완성 (`EXTERNAL_AI_URL` / `EXTERNAL_AI_KEY` 실제 동작 검증)
2. Context Panel Phase 4 — Java 파일 스캔 + MainPanel→ContextPanel 브리지 (CustomEvent)
3. GraphView Path Finder 기능 추가

### ⚠️ 블로커/주의사항
- 레시피 삭제는 `DELETE /context/recipes/{name}` (URL 인코딩 필요)
- 패킷 다운로드: `API + data.download` (`/export/file?path=...`)
- `over_budget` 강조는 `budget` 파라미터 전달 시에만 활성화 (현재 미사용)
- GraphView: `pairEdges` Map으로 양방향 엣지 감지 (`a|b` 키, undirected pair)

### 🚫 절대 규칙
- `app.state.last_index` 직접 수정 금지 — `/main/layout/basic` POST 통해서만 갱신
- `.env` 파일 절대 커밋 금지 (AI 키 포함)
- `start.bat`을 브라우저 방식으로 되돌리지 말 것 (pywebview 방식 유지)

### 💡 한 줄 요약
👉 **"Context Panel 기능 완성"**

---

## 완료된 작업 ✅

### Context Panel 전면 개선 (2026-05-07)
- **관련 파일**: `frontend/src/components/ContextPanel.jsx`, `context/routes.py`, `context/utils.py`, `frontend/src/context.jsx`
- **변경사항**:
  - **Reference 파일 추가 UI** — Primary/Reference 드롭다운 분리 (파란/초록 칩으로 구분)
  - **레시피 저장/불러오기/삭제 UI** — 상단 툴바에 레시피 드롭다운 + 저장 입력창 추가
  - **MCP API 키 표시** — `GET /settings` → 클립보드 복사 버튼
  - **워크스페이스 재스캔 버튼** — `↺ 재스캔` 버튼으로 `POST /workspace/scan` 호출
  - **패킷 다운로드 링크** — 준비 완료 후 `↓ 다운로드 (N tok)` 링크 표시
  - **textarea → instruction 연결** — AI 지시문이 패킷 맨 앞에 포함됨 (`PrepareReq.instruction`)
  - **시크릿 경고 배너** — 미리보기 모달에 노란 배너 + 패킷 준비 시 confirm 다이얼로그
  - **토큰 초과 섹션 강조** — `over_budget` 섹션 빨간 배경으로 표시
  - **레시피 삭제 엔드포인트** — `DELETE /context/recipes/{name}` 추가
  - **token_guess 계산 통일** — `split_md_sections`도 `approx_tokens()` (* 1.3) 사용
  - **context.jsx 스모크 테스트 제거** — `insertAdjacentHTML` 잔재 코드 삭제

### 로그 패널 + 오버레이 시각화 (2026-05-05)
- **관련 파일**: `frontend/src/components/LogPanel.jsx`, `frontend/src/log.jsx`, `logs/routes.py`, `logs/utils.py`, `main/compare_utils.py`, `main/watcher.py`, `app.py`
- **변경사항**:
  - `LogPanel` — 체크포인트 타임라인 + 파일 이벤트 목록 UI. `#logRoot`에 별도 React 루트로 마운트
  - `logs/routes.py` — `GET /logs/timeline` (체크포인트 + 파일 이벤트 병합), `GET /logs/checkpoints`
  - `compare_utils.py` — `compare_states(from, to)` → `{changes: [{anchor, kind, locDelta, ranges}]}` 배열
  - 오버레이: baseline 클릭 시 `baseline-changed` 커스텀 이벤트 → `App.jsx` → `MainPanel.jsx`
  - MethodRow: dot은 접근자 색 유지, overlay는 왼쪽 border stripe(teal/purple/red)로 표시
  - Ghost 메서드: checkpoint에 있고 working에 없는 메서드 → 트리에 회색 ghost로 표시

### GraphView Obsidian 스타일 전면 개편 (2026-05-06)
- **관련 파일**: `frontend/src/components/GraphView.jsx`
- **변경사항**:
  - **노드 렌더링**: 방사형 gradient aura + shadowBlur bloom (Obsidian 글로우 효과)
  - **엣지 가시성**: 기본 alpha 0.35, 두께 1.1/k, 미세 glow(shadowBlur 2/k)
  - **Hover dim**: `hoverNodeRef` 추가 → hover 시 서브그래프 외 노드/엣지 dim(0.06/0.04)
  - **Floating 노드 수정**: warmup 후 `alpha(0.06)` + `alphaDecay(0.04)` (기존 0.3 재시작 제거)
  - **패키지 트리 레이아웃**: canvas 중심 기준 top-down 좌표 (`treeCx`, `treeCy`)
  - **엣지 교차 최소화**: repulsion -100~-250, 패키지 응집력(k=0.008/0.003), barycentric 8회 post-processing
  - **양방향 화살표**: `pairEdges` undirected-pair Map으로 A→B + B→A 감지
    - 같은 종류 양방향: 단일 선 + 양쪽 화살촉 (◀──▶)
    - 다른 종류 양방향: 중점 분할 + 각각 화살촉 (▶◀)
  - **엣지 타입 색상**: calls(파랑), references(보라), extends(황), implements(cyan), belongs_to(에메랄드), structure(인디고)

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
- **관련 파일**: `main/routes.py`, `main/java_indexer.py`
- **변경사항**: `app.state.last_index` 캐시로 워크스페이스 조회, `range.start`를 시그니처 시작 줄로 수정

### anchor_utils 패키지 리팩터링
- **완료일**: 2026-04-29
- **주의**: `ui_anchor`, `ai_anchor`는 생성됐으나 아직 실제 연결 미완

### java_indexer 개선 / 프로젝트 문서화 / MainPanel 시각화 개선 3종
- **완료일**: 2026-04-29
- 상세 내용은 이전 커밋 참조

---

## 진행 중인 작업 🔄

없음. 다음 우선순위 참조.

---

## 다음 작업 예정 📋

### 우선순위 1 (AI 연동)
- [ ] 외부 AI 콜백 플로우 완성 — `EXTERNAL_AI_URL` / `EXTERNAL_AI_KEY` 실제 동작 검증
- [ ] AI 분석 결과 MainPanel 연동 — `analyze_runner.py` 결과를 UI에 표시

### 우선순위 2 (Context Panel Phase 4)
- [ ] Java 파일 스캔 지원 — `app.py`의 `*.md` glob을 `*.java`로 확장
- [ ] Java 메서드 → Context 브리지 — MainPanel `selected` Set → ContextPanel (CustomEvent 패턴)

### 우선순위 3 (고도화)
- [ ] GraphView Path Finder 기능
- [ ] LOD (Level of Detail) 최적화

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
(이번 세션) feat: Context Panel Phase 1~3 — Reference UI, 레시피, MCP 키, 지시문, 시크릿 경고
5c970e4 feat: GraphView Obsidian 스타일 전면 개편
554afef feat: 로그 패널 + 오버레이 시각화 + anchor 버그 수정
4aa4d91 feat: 클래스 접기/펼치기 + LOC 히트맵 추가
4bbe75d refactor: 코드뷰 복사 버튼 제거
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
