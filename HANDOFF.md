# 작업 인수인계 - Handoff Document

> **프로젝트**: aiworkflow (Java 코드 분석 & AI 편집 플랫폼)
> **마지막 업데이트**: 2026-05-27 (MainPanel 트리뷰 대규모 개선 + 진단 빌드도구 자동감지)
> **브랜치**: `actc3` → `https://github.com/dpp-pixel/aiworkflow`

---

## 🚀 AI QUICK START (READ THIS FIRST!)

### 📍 현재 작업
- `_extract_annotations()` 버그 수정 완료 (`main/java_indexer.py:33-47`)
  - 수정: `_ANNOT_TYPES` 4종 세트 + `modifiers` 자식 노드 순회 추가
  - 결과: `@WebServlet`, `@Data`, `@Getter`, `@Setter` 등 모든 어노테이션 정상 추출 확인
- demo_lib 뱃지(P/C/I/E/R) 전체 표시 → API 검증 PASS
- movie_collector 어노테이션 뱃지 → 버그 수정 후 API 검증 PASS
- 상태: **`main/java_indexer.py` 수정 미커밋**

### ⚡ 다음 할 일 (우선순위 순)
1. `main/java_indexer.py` 어노테이션 버그픽스 커밋 (`git push origin actc3`)
2. ContextPanel 자동 링킹 (트리/그래프 뷰 API 연결 시)
3. Sig AI Step 2 diff 파싱 폴백 개선
4. 멀티앵커 병렬 처리 (Sig AI)

### ⚠️ 블로커/주의사항
- sync 라우트에서 `asyncio.create_task()` 절대 사용 금지 → `BUS.publish_sync()` 사용
- `main/checkpoint_utils.py` 의 `MANI`는 `_ManiProxy` (backward compat) — 직접 Path로 바꾸지 말 것
- Maven 빌드: `pom.xml` 존재 여부로 감지, mvnw 없으면 PATH의 mvn 사용

### 🚫 절대 규칙
- `app.state.last_index` 직접 수정 금지 — `/main/layout/basic` POST 통해서만 갱신
- `.env` 파일 절대 커밋 금지 (AI 키 포함)
- MCP 키 별도 생성/저장 로직 부활 금지 — `external_key` 재사용 방식으로 고정
- 외부 AI 배지는 절대 제공자명 표시 금지 — "● 외부" 로만 표시

### 💡 한 줄 요약
👉 **"어노테이션 추출 버그 수정 미커밋"**

---

## 완료된 작업 ✅

### MainPanel 트리뷰 UI 개선 + 진단 빌드도구 자동감지 (2026-05-27)
- **관련 파일**: `frontend/src/components/MainPanel.jsx`, `main/java_indexer.py`, `main/diagnostic_utils.py`, `main/routes.py`, `frontend/src/components/DiagnosePanel.jsx`
- **변경사항**:
  - **Dead files 삭제**: `frontend/src/context.jsx`, `frontend/src/log.jsx`, `frontend/src/app-entry.jsx`
  - **레이아웃**: 패키지 목록 grid → flex-column (빈 공간 제거)
  - **Kind 뱃지**: P(패키지/인디고), C(클래스/스카이), I(인터페이스/틸), E(enum/핑크), R(record/퍼플) — 접근자 색과 분리된 별도 팔레트
  - **Tip 컴포넌트**: 다크테마 호버 툴팁 (흰 상자 → `#1c2128` 배경, `#c9d1d9` 텍스트)
  - **FieldRow 컴포넌트**: 필드를 메서드 위에 구분선과 함께 표시
  - **어노테이션 뱃지**: `@` 어노테이션을 핑크(`#e879f9`) 배지로 클래스/메서드 행에 표시
  - **CopyBtn 비동기 getText**: 클래스 복사 버튼이 `GET /main/file-content`로 Java 파일 전체 내용 복사
  - **buildClassText()**: 파일 fetch 실패 시 폴백 텍스트 생성
  - **legend 뱃지화**: 범례를 뱃지 스타일로 변경, `pkg` → `default` 레이블 수정
  - **java_indexer.py**: `kind` 필드(`class`/`interface`/`enum`/`record`) + `annotations` 필드 추가
  - **인터페이스 visibility**: `is_interface=True` 컨텍스트로 기본값 `public` 처리
  - **enum 파싱**: `enum_body_declarations` 확장으로 내부 멤버(메서드/필드) 표시
  - **enum_constant 추출**: enum 상수를 fields 배열에 포함
  - **diagnostic_utils.py**: `detect_build_tool()`, `run_maven_compile()`, `parse_maven_output()`, `run_gradle_compile()`, `run_compile()`, `parse_compile_output()` 추가
  - **routes.py**: `GET /main/file-content` (경로 탈출 방지 포함), 진단 엔드포인트 `run_compile()` 통합
  - **test_workspace/demo_lib/**: 4개 패키지, 13개 Java 파일 (C/I/E/R 전체 포함)
- **수정된 버그**:
  - `main/utils.py` 파일 시작에 `u` 문자 스타트 → `NameError: name 'u' is not defined` 수정
  - 인터페이스 메서드가 `package` visibility로 표시되던 문제
  - enum 본문에 아무것도 안 나오던 문제 (`enum_body_declarations` 미처리)
  - UML `+/#/-/~` 기호 → 사용자 요청으로 원래 컬러 점으로 되돌림

### 언어 독립 인덱서 추상화 (2026-05-27)
- **관련 파일**: `main/indexers/base.py` (신규), `main/indexers/java.py` (신규), `main/indexers/__init__.py` (신규), `main/compare_utils.py`, `main/graph_utils.py`, `main/relations_utils.py`, `main/watcher.py`, `main/routes.py`
- **변경사항**:
  - `IndexerBase` ABC 정의 — `extensions`, `get_namespace(content, file_path, workspace)`, `get_units(content)`, `parse_file_members(content, file_path, workspace)`, `index_workspace(workspace)`
  - `JavaIndexer` — 기존 `java_indexer.py` 위임 래퍼로 구현
  - 레지스트리 (`__init__.py`) — `register()`, `for_file(path)`, `all_extensions()`, `index_workspace(workspace)`
  - `compare_utils`, `graph_utils`, `relations_utils`, `watcher`, `routes` 전 계층에서 `.java` 하드코딩 제거 → `all_extensions()` / `for_file()` 로 교체
  - Python/Go 등 추가 시: `IndexerBase` 구현 후 `register()` 호출 한 줄로 완성
- **테스트 프로젝트**: `test_workspace/shop_demo/` — model/repository/service 3패키지, 8파일 (interface, enum, class, generics 포함)
- **상태**: 미커밋, import 검증 완료

### React 구조 통합 리팩토링 (2026-05-26)
- **관련 파일**: `frontend/src/App.jsx`, `frontend/src/main.jsx`, `frontend/index.html`, `frontend/src/components/FolderPicker.jsx`, `frontend/src/components/ContextPanel.jsx`, `frontend/src/components/LogPanel.jsx`, `app.py`, `main/watcher.py`, `main/compare_utils.py`, `main/java_indexer.py`
- **변경사항**:
  - **단일 React 루트** — 기존 4개 독립 `ReactDOM.createRoot()` → App.jsx 하나로 통합
  - **App.jsx 전면 재작성** — workspace state 소유, 7:3 그리드(좌: ContextPanel + MainPanel/GraphView, 우: LogPanel), 헤더에 📁 열기 + ⚙ AI 설정 버튼
  - **FolderPicker.jsx 신규** — 바닐라JS 폴더피커를 React 컴포넌트로 교체 (`GET /workspace/browse` 호출)
  - **ContextPanel** — `workspace` prop으로 수신, 자체 워크스페이스 입력 UI 제거, workspace 변경 시 자동 재로드
  - **LogPanel** — `workspace` prop으로 수신, useEffect 의존성에 workspace 추가
  - **백엔드 `_do_switch_workspace()`** — workspace 전환 시 원자적으로: workspace 설정 → db 초기화 → last_index 초기화 → 설정 저장 → watcher 재시작 → SSE `workspace_changed` 발행
  - **`GET /workspace/current`** — App.jsx 마운트 시 초기 workspace 로드용
  - **`restart_watcher()`** — 기존 watcher stop_event 설정 후 새 watcher 시작 (워크스페이스 변경 시 파일 감시 재시작)
  - **compare_utils.py 수정** — `_find_package`, `_iter_classes` 임포트 오류 수정 (java_indexer.py에 tree-sitter 래퍼로 복원)

### Paste&Apply Preview + AST 파서 전환 (2026-05-22)
- **관련 파일**: `main/routes.py`, `frontend/src/components/PasteApplyPanel.jsx`, `frontend/src/components/ContextPanel.jsx`, `main/java_indexer.py`, `requirements.txt`
- **변경사항**:
  - **Paste&Apply preview 단계** — 분석 결과를 바로 적용하지 않고 review 후 적용하도록 2-step으로 분리
    - `POST /main/ai/paste-apply` — `dry_run: true` 시 ops 배열만 반환 (파일 미수정)
    - `POST /main/ai/paste-apply-ops` — 사전 파싱된 ops를 받아 적용 (`_do_apply_ops` 헬퍼 공유)
    - `PasteApplyPanel.jsx`: `idle | parsing | preview | applying | done` 5단계 state machine
      - preview 단계: `OpCard` (create/modify/delete 색상 코딩, diff/content 접기펼치기)
      - `DiffPreview`: +/- 라인 색상 구분, 40줄 초과 시 줄임 표시
      - 취소 시 입력 텍스트 보존 (idle 복귀), 재분석 가능
  - **ContextPanel 하드코딩 제거** — `C:\\Users\\82104\\my_project` 제거 → `wsInput` state + 텍스트 입력 + "설정" 버튼 (Enter 키 지원)
  - **Java 파서 AST 전환** — `main/java_indexer.py` 정규식 폴백 완전 제거 (PKG_RE, CLASS_RE, METHOD_SIG_RE 등 삭제)
    - tree-sitter AST만 사용: `child_by_field_name("body")`로 본문 정확히 위치 추출
    - 메서드 시그니처: `src[node.start_byte:body.start_byte]` 슬라이싱 (문자열/주석 내 `{` 오인식 없음)
    - `_get_body_members()`: `class_body / interface_body / enum_body / record_body` 지원
    - `requirements.txt`: `tree-sitter`, `tree-sitter-java` 추가 (타인 실행 시 의존성 누락 방지)
    - `_make_parser()`: tree-sitter API 버전 호환성 try/except 처리

### 3-Mode AI 아키텍처 구현 (2026-05-20)
- **관련 파일**: `main/routes.py`, `main/watcher.py`, `logs/routes.py`, `logs/utils.py`, `context/routes.py`, `frontend/src/components/PasteApplyPanel.jsx`, `frontend/src/components/LogPanel.jsx`, `frontend/src/components/ContextPanel.jsx`
- **변경사항**:
  - **Paste & Apply** (`POST /main/ai/paste-apply`) — ChatGPT 응답 텍스트 → Ollama가 JSON 배열로 파싱 → create/modify/delete 실행
    - `_PARSE_SYSTEM`: Java 파일 패키지 선언 추론 규칙 포함 (경로 → package 매핑)
    - 실행 전 `app.state.last_index`에서 현재 프로젝트 패키지/클래스 컨텍스트 주입
    - `_extract_diff` fallback (JSON 파싱 실패 시 단일 diff로 처리)
    - `log_ai_edit()` 로그 기록 + `BUS.publish_sync()` SSE 발행
  - **자동 로그 분석** — `logs/utils.py:log_file_change()` log_id 반환하도록 수정
    - `main/watcher.py`: 파일 변경 감지 후 daemon thread로 `_auto_analyze_log(log_id)` 실행
    - `_auto_analyze_log()`: `logs` 테이블 조회 → Ollama 분석 → `summary` 컬럼 저장
    - `_ANALYZE_SYSTEM`: "작업: ...\n의도: ..." 형식 2문장 한국어 분석
  - **분석 수정** (`PATCH /logs/{log_id}/summary`) — 사용자가 Ollama 분석 텍스트 직접 수정 가능
  - **계획 메모장** (`/context/plans/*`) — 레시피 패턴 재사용, `.contextpanel/plans/{name}.json`
    - `POST /context/plans/save`, `GET /context/plans`, `GET /context/plans/{name}`, `DELETE /context/plans/{name}`
  - **PasteApplyPanel.jsx** 신규 — textarea + 실행 버튼 + 결과 목록 (성공/실패 색상)
  - **LogPanel.jsx** — "붙여넣기" 4번째 탭 추가, FileEventEntry에 분석 표시 + ✏ 인라인 편집 UI
  - **ContextPanel.jsx** — 지시문 섹션 → 계획 메모장 (드롭다운 + 저장/버전추가/삭제 버튼)

### SSE BUS 수정 + 복사 버튼 + AI 요약 토글 + project_test2 (2026-05-11)
- **관련 파일**: `main/event_bus.py`, `main/routes.py`, `main/watcher.py`, `main/checkpoint_utils.py`, `app.py`, `logs/routes.py`, `frontend/src/components/LogPanel.jsx`, `frontend/src/components/MainPanel.jsx`, `project_test2/`
- **변경사항**:
  - **SSE BUS 크로스-스레드 수정** — sync 라우트에서 `asyncio.create_task()` 사용 불가 문제 해결
    - `event_bus.py`: `set_loop()`, `publish_sync()` 추가 (run_coroutine_threadsafe 패턴)
    - `app.py`: startup 이벤트에서 `BUS.set_loop(asyncio.get_event_loop())` 등록
    - `main/routes.py`: 4군데 `asyncio.create_task(BUS.publish(...))` → `BUS.publish_sync(...)` 교체
    - `watcher.py`: `new_event_loop` 방식 → `BUS.publish_sync()` 교체
  - **체크포인트 동적 경로** — `checkpoint_utils.py`의 모듈 레벨 고정 상수를 동적 함수로 교체
    - `_ckpt_root()`, `_blobs()`, `get_mani()` 함수 + `_ManiProxy` backward compat 클래스
    - `list_checkpoints()` 워크스페이스 미설정 시 예외 대신 `[]` 반환
  - **AI 요약 ON/OFF** — LogPanel AI 탭에 "요약 ON/OFF" 토글 버튼 추가
    - `summaryMode` state (localStorage 유지), 요약 ON → instruction 대신 summary 표시
    - "요약 생성" 버튼 per 엔트리, `POST /logs/ai-sessions/{log_id}/summarize` 호출
    - `logs/routes.py`: summarize 엔드포인트 추가, `summary TEXT` 컬럼 마이그레이션
  - **복사 버튼** — MainPanel/LogPanel 전반에 CopyBtn 추가
    - MainPanel: 클래스 헤더 FQCN 복사, 코드 펼침 뷰 상단 "⎘ 복사" 버튼
    - LogPanel: 지시문 복사, Diff 복사
    - 메서드 행 복사 버튼은 AI 버튼 오버랩으로 제거 (코드 펼침에서만 복사)
  - **browser 모드 워크스페이스 스캔** — `index.html` fpSelect.onclick에 `POST /workspace/scan` 추가
  - **project_test2** — 컴퓨터 부품 구입 앱 Java 구조 테스트용 프로젝트 생성
    - `model/`: Part, Cart, CartItem, Order
    - `dao/`: PartDao, OrderDao
    - `service/`: PartService, CartService, OrderService
    - `servlet/`: PartListServlet, CartServlet, OrderServlet

### 로그패널 AI 히스토리 3탭 + Sig AI 요청 + MCP 외부화 (2026-05-08 세션 2)
- **관련 파일**: `frontend/src/components/LogPanel.jsx`, `frontend/src/components/MainPanel.jsx`, `frontend/src/components/ContextPanel.jsx`, `main/routes.py`, `logs/routes.py`, `logs/utils.py`, `app.py`, `context/routes.py`
- **변경사항**:
  - **LogPanel 3탭** — "AI 편집 / 체크포인트 / 파일변경" 탭 구조로 전면 재작성, 헤더 "AI 히스토리"
    - `AiEditEntry`: 제공자 배지(Ollama/OpenAI/외부) + 지시문 + diff 접기/펼치기
    - `AiApplyEntry`: 초록 적용 완료 행
    - `fetchAll()`: `/logs/timeline` + `/logs/ai-sessions` 병렬 호출
  - **logs/utils.py** — `log_ai_edit()`, `log_ai_apply()` 함수 추가
  - **logs/routes.py** — `GET /logs/ai-sessions` 엔드포인트 추가 (ai_edit/ai_apply 타입 반환)
  - **Sig AI 요청** — MainPanel에 SigAiModal 추가 (Sig 모드일 때만 "🤖 AI 요청" 보라색 버튼 표시)
    - Step 1: 시그니처 컨텍스트 → AI가 대상 앵커 JSON 식별
    - Step 2: 실제 코드 → AI가 앵커별 unified diff 생성
    - `POST /main/ai/sig-request`, `POST /main/ai/sig-apply` 엔드포인트 추가
    - sig-apply: 자동 체크포인트 + 다중 파일 diff 적용 (region lock 없음)
  - **ContextPanel UX 개선** — Primary/Reference 드롭다운 고정 위치(스크롤 영역 위), 지시문 textarea 접기/펼치기
  - **MCP 키 제거** — `app.py`에서 `secrets`, `api_key`, `persist_mcp_key` 완전 제거
  - **context/routes.py** — `_require_api_key`가 `cfg["ai"]["external_key"]` 재사용으로 교체

### AI 제공자 설정 + 수정 모드 UX 개편 (2026-05-08)
- **관련 파일**: `frontend/src/components/AiEditModal.jsx`, `frontend/src/components/AIProviderModal.jsx`, `app.py`, `main/routes.py`, `frontend/src/App.jsx`
- **변경사항**:
  - **AIProviderModal** 신규 — Ollama / OpenAI API / 외부 서버 라디오 선택 + 각 제공자 설정 필드 + 시스템 프롬프트 커스텀 + 연결 테스트
  - **App.jsx** — 상단 탭바에 ⚙ 버튼 → AIProviderModal 열기
  - **AiEditModal UX 전면 개편** — 지시문 입력창 최상단 + 코드뷰 접기/펼치기 + 탭: 외부 AI / 내부 AI
    - 기본 탭: "내부 AI" (`mode = "internal"`)
    - 제공자 배지: Ollama → "● 기본 (Ollama)", 그 외 → "● 외부"
    - 내부 AI 탭: "AI에게 보내기" → 자동 diff 수신 → 적용
    - 외부 AI 탭: 프롬프트 복사 → diff 붙여넣기 → 적용
    - Enter 키 → 내부 AI 전송 (내부 AI 탭일 때)
  - **app.py** — `_DEFAULT_CFG.ai` 블록에 multi-provider 설정 추가 (`openai_key`, `openai_model`, `external_url`, `external_key`, `public_base_url`, `system_prompt`)
  - **routes.py** — `POST /main/ai/complete` Ollama/OpenAI/External 분기 처리, `GET /main/ai/test` 연결 테스트, `_DIFF_SYSTEM_PROMPT` 상수 + 커스텀 프롬프트 지원

### Context Panel 전면 개선 (2026-05-07)
- **관련 파일**: `frontend/src/components/ContextPanel.jsx`, `context/routes.py`, `context/utils.py`, `frontend/src/context.jsx`
- **변경사항**:
  - **Reference 파일 추가 UI** — Primary/Reference 드롭다운 분리 (파란/초록 칩으로 구분)
  - **레시피 저장/불러오기/삭제 UI** — 상단 툴바에 레시피 드롭다운 + 저장 입력창 추가
  - **워크스페이스 재스캔 버튼** — `↺` 아이콘 버튼으로 `POST /workspace/scan` 호출
  - **패킷 다운로드 링크** — 준비 완료 후 `↓ 다운로드 (N tok)` 링크 표시
  - **textarea → instruction 연결** — AI 지시문이 패킷 맨 앞에 포함됨 (`PrepareReq.instruction`)
  - **시크릿 경고 배너** — 미리보기 모달에 노란 배너 + 패킷 준비 시 confirm 다이얼로그
  - **토큰 초과 섹션 강조** — `over_budget` 섹션 빨간 배경으로 표시
  - **레시피 삭제 엔드포인트** — `DELETE /context/recipes/{name}` 추가

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
  - 노드 렌더링: 방사형 gradient aura + shadowBlur bloom (Obsidian 글로우 효과)
  - Hover dim: `hoverNodeRef` 추가 → hover 시 서브그래프 외 노드/엣지 dim
  - 양방향 화살표: 같은 종류(단일 선 + 양쪽 화살촉), 다른 종류(중점 분할)
  - 엣지 타입 색상: calls(파랑), references(보라), extends(황), implements(cyan)

### 수정 모드 stub 기능 제거 (2026-05-05)
- **관련 파일**: `frontend/src/components/MainPanel.jsx`
- **제거**: `batchSubmitting`, `buildBatchPayload`, `handleBatchApply`, "ZIP 내보내기", "일괄 적용", "되돌리기" 버튼

### ui_anchor / ai_anchor 정규화 버그 수정 (2026-05-05)
- **관련 파일**: `main/anchor_utils/ui_anchor.py`, `main/anchor_utils/ai_anchor.py`
- **버그**: 정규식이 return type과 method name을 한꺼번에 제거 → 메서드명 소실
- **수정**: `re.match`로 ReturnType / methodName 명확히 분리

### 워크스페이스 폴더 선택기 / pywebview 데스크톱 앱 / 메서드 본문 조회 버그 수정 (2026-04-29)
- `app.py` — `/workspace/browse` GET 엔드포인트 추가
- `desktop.py` — uvicorn + pywebview 런처
- `start.bat` — frontend dev + `py desktop.py` 포그라운드 실행
- `main/routes.py`, `main/java_indexer.py` — `app.state.last_index` 캐시로 워크스페이스 조회, `range.start`를 시그니처 시작 줄로 수정

---

## 진행 중인 작업 🔄

없음. 다음 우선순위 참조.

---

## 다음 작업 예정 📋

### 우선순위 1 (커밋 및 검증)
- [ ] 변경사항 전체 커밋 (`git push origin actc3`)
- [ ] demo_lib 워크스페이스에서 전체 kind 뱃지 표시 검증

### 우선순위 2 (메인 패널 → ContextPanel 자동 연동)
- [ ] 트리뷰/그래프뷰에서 API 연결 시 ContextPanel도 자동으로 연동되도록 구현

### 우선순위 3 (Sig AI 요청 안정성)
- [ ] Step 2 diff 파싱 fallback — AI가 비정상 응답 시 에러 메시지 명확히 표시
- [ ] 다중 앵커 병렬 처리 (현재 순차)

---

## 중요 사항 ⚠️

### 환경 설정
- `.env` 파일에 AI 키 설정 필요 (커밋 금지)
- `OLLAMA_URL` (기본: `http://localhost:11434`)
- `EXTERNAL_AI_URL`, `EXTERNAL_AI_KEY` (외부 AI 서버)

### 알려진 이슈
1. **인덱스 캐시 미동기화**: 워크스페이스 파일 수동 변경 시 자동 재인덱스 안 됨 → "새로고침" 버튼 필요
2. **anchor_utils 미연결**: `ui_anchor.py`, `ai_anchor.py` 구현은 됐으나 실제 호출 없음
3. **Sig AI Step 2 경로 추측**: AI가 잘못된 파일 경로 반환 가능 — `real_file` 인젝션으로 완화

### 개발 환경
- Python 3.11, FastAPI, uvicorn, pywebview
- Node.js, React, Vite
- Ollama (로컬 AI 서버)

---

## 최근 커밋

```
623d554 fix: AiEditModal 제공자 배지 외부로 단순화 (provider name 제거)
83af016 refactor: AiEditModal UX 전면 개편
bc36604 feat: AI 편집 모달 개선 — 탭 이름 / 지시 입력 / 시스템 프롬프트 커스텀
bbbc3c5 feat: MainPanel 시그니처 뷰 + 토큰 카운터 + 앵커 복사
2b18622 revert: GraphView Path Finder 제거
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
