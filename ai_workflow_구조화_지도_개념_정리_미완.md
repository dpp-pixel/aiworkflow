# AI WORKFLOW & 구조화 지도 — 개념 정리 v0.1

> 목적: “바이브 코딩이 쉽게” + “유지보수가 직관적” + “AI가 읽고 고치기 쉬운” 코드 작업 환경을 웹에서 제공한다.

---

## 1) 비전과 핵심 목표

- **바이브 코딩 가속**: 긴 파일/클래스를 **작게 구조화**해서 AI/사람이 빠르게 맥락 파악·편집.
- **안전한 리팩터링**: 로그와 \*\*분기점(Checkpoint)\*\*으로 언제든 되돌리기.
- **AI 친화 설계**: 맥락(MD) + AST 구조 + 변경 의도를 AI가 **정확히 이해**하도록 프롬프트/데이터를 표준화.

---

## 2) 사용자 시나리오(요약)

- **개발자**: 자바 프로젝트를 불러오면\*, 좌측 상단에서 맥락 MD를 편집/첨부 → 좌측 메인에서 클래스/메서드 구조를 시각화 → 특정 메서드에 대해 AI 편집 제안 → 우측 로그에서 “왜/무엇을” 기록하고 **분기점 저장** → 문제가 생기면 분기점으로 **즉시 복귀** → 최종 로그를 **MD로 내보내기**.\*
- **리뷰어/PM**\*(선택): 변경 이력/근\*거를 MD로 받아서 리뷰.

---

## 3) 정보구조 & 레이아웃

**레이아웃(7:3, 우측 로그 패널 고정):**

```
┌─────────────────────────── 70% ───────────────────────────┬────────── 30% ───────────┐
│  (좌상단) 맥락 패널                                         │  로그 & 분기점 패널        │
│  - 입력창/MD 업로드/다운로드                                 │  - 변경 로그(무엇/왜)      │
│  - 프로젝트 메타(YAML front-matter)                         │  - 오류/수정 이력          │
│                                                              │  - 분기점 생성/복구        │
│  (좌중앙) 구조 시각화(메인)                                  │  - MD Export 버튼          │
│  - 파일트리 → 클래스 → 메서드/필드                           │                          │
│  - AST/호출 그래프/복잡도 메트릭                             │                          │
│  - AI 편집 모드(선택 노드에 제안/적용/미리보기)              │                          │
└──────────────────────────────────────────────────────────────┴──────────────────────────┘
```

- **좌상단: 맥락 패널**
  - 자유 텍스트 + **MD 파일 첨부**(YAML front-matter 지원: 프로젝트명, 목표, 제약, 스타일 가이드 등)
  - 맥락 자동 요약/정규화(카테고리+태그)
- **좌중앙: 구조 시각화(메인)**
  - 언어별 파서(AST)로 **클래스/메서드/필드** 계층을 트리/그래프로 시각화
  - “AI 편집 모드”: 선택 노드 기준으로 **프롬프트 패키징**(주의: 의존 관계 자동 수집)
- **우측: 로그·분기점**
  - 변경 ‘무엇/왜(의도)’ 기록, 자동/수동 태깅
  - **분기점(Checkpoint)** 생성/복구, 브랜치 관리, Diff 미리보기
  - 전체 로그 **Markdown Export**

---

## 4) 핵심 기능 상세

### 4.1 맥락 패널

**핵심 원칙**: 이 영역의 **MD 파일은 요약하지 않고 전체가 AI에 전달**된다(Full‑Read 보장). 텍스트 박스는 사람을 위한 설명/보조 메모이며, AI가 읽는 1순위 소스는 **첨부된 MD 원문**이다.

**UI/UX**

- **텍스트 박스(직사각형)**: 기본 4줄 노출, 길어지면 `…`로 축약. 우측 **∨** 토글로 전체 펼치기/접기. 하단에 “연결된 MD: `<파일명.md>` 칩 + **X**(제거) + `⋯`(바꾸기/다운로드/열기)”.
- **MD 업로드**: 드래그&드롭/파일 선택. *Primary Context(필수 1개)* + *Reference MD(옵션 N개)* 지원. Primary는 AI 프롬프트에 항상 **전부** 포함. \*\*우선순위는 업로드 순서(Primary → 이후 업로드한 Reference 순서)\*\*로 전송/처리.
- **Front‑Matter(옵션)**: MD 상단 YAML을 폼으로도 편집(양방향 동기화). 없어도 동작.
- **미리보기**: “AI로 전달될 내용 보기(Full‑Read)” 버튼 → 실제 전송 순서/섹션 해시/토큰 추정치 표시.

**보조 태깅(정의/효과)**

- **정의**: MD 원문을 **변형하지 않고**, 제목/키워드/라벨을 자동 추출해 **칩 형태로 표시**하는 *UI 전용 인덱싱* 기능. AI에게 보내는 내용은 변하지 않음.
- **대상**: 헤딩(H1–H3), Front‑Matter 키(`goals`, `constraints` 등), 라벨 패턴(`Goal:`, `Constraint:`), 코드 참조(`Class#method`).
- **이점**: 빠른 탐색/필터, 구조 뷰와의 링크(칩 클릭 → 해당 노드로 점프), 리뷰 시 "왜/무엇" 근거를 즉시 재확인.
- **제어**: 켜기/끄기 토글 제공(기본 **꺼짐**·사용자 승인 후 사용). 태깅 결과는 검색 필터와만 연동.
- **예시**: `goals:p95<200ms`, `constraint:no_new_deps`, `ref:UserService#resetPassword` 칩이 상단에 나타나며 클릭 시 관련 섹션/노드로 이동.

**Full‑Read Ingestion(전체 읽기) 설계(전체 읽기) 설계**

- **섹션 분할**: MD를 Heading 단위(예: H1/H2)로 분할하여 **순차 스트리밍**. 각 섹션 SHA‑256 해시를 계산.
- **전송 보증**: 모델 호출 시 `ingestion_id`와 함께 (섹션, 순번, 해시) 메타를 첨부. 최종 응답에 **처리한 섹션 목록+해시**를 회신시켜 *전부 읽었는지* 확인(Attestation).
- **세션 캐시**: 같은 `ingestion_id` 동안 재전송 생략(토큰 절약) 가능. 단, *처음* 한 번은 반드시 전체 전송.
- **크기 한계 대응**: 매우 큰 MD는 여러 호출로 나누되, 순서를 강제하고 누락 시 재시도. 요약 **금지**, 단 전체 전송을 완료할 때까지 단계적 호출.

**API**

- `POST /projects/:id/context/md` : Primary/Reference 업로드(메타에 role 저장)
- `POST /projects/:id/context/ingest` : 섹션화/해시 생성 → `ingestion_id` 반환
- `POST /projects/:id/context/secrets/scan` : MD 내 시크릿 사전 스캔 결과 반환
- `GET /projects/:id/context/preview` : 실제 전송본(섹션 순서/해시/토큰)을 미리보기
- `POST /nodes/:id/ai/suggest?ingestion_id=...` : Full‑Read 컨텍스트 동반 호출
  - body 옵션: `{ masking: "auto" | "force" | "off" }`
    - `auto`(기본): 발견 시 동의 모달 → 사용자의 선택 반영
    - `force`: 항상 마스킹 후 전송
    - `off`: 마스킹 없이 전송(동의 모달에서 허용된 세션에 한함)

**보안/검증**

- 허용 확장자 `.md`(UTF‑8), 크기 제한(예: 5MB/파일). 스크립트/HTML Sanitize(렌더링 시).
- 시크릿 스캔 & 동의 플로우: 아래 참조.
- 허용 확장자 `.md`(UTF‑8), 크기 제한(예: 5MB/파일). 스크립트/HTML Sanitize(렌더링 시).
- **시크릿 스캔 & 동의 플로우**:
  1. 업로드 또는 전송 직전 키/토큰/비밀 패턴을 탐지하면 **동의 모달** 표시.
  2. 메시지: "민감정보가 감지되었습니다. 마스킹 없이 전송할까요?"\
     버튼: **마스킹하고 보냄(기본)** / 마스킹 없이 보냄 / 취소
  3. 동의 선택은 프로젝트 로컬에 저장(세션 단위). 매 호출 시 다시 묻기 옵션 제공.
  4. **마스킹 규칙**: 중간 60%를 `•`로 대체, 길이는 보존. 예) `sk-abc123456789` → `sk-•••••••••789`.
- 저장 정책: **원문 MD는 저장소에 암호화 상태로 그대로 보관**. 모델 전송 페이로드에는 사용자의 선택(마스킹/비마스킹)이 적용됨.

**사람 vs AI의 역할 정리**

- **사람**: 텍스트 박스와 MD로 “왜/무엇/어떻게” 명확화, 핵심 원칙 고정.
- **AI**: Primary MD 전체를 읽고, 좌중앙 구조 뷰의 **선택 노드 범위**에 한정하여 제안/패치 생성.

**Source of Truth(결정)**

- 텍스트와 MD 내용이 상충할 경우 **MD 원문이 우선**한다.

#### 4.1-MVP (확장 가능 최소본)

> 지금은 **컨텍스트 영역만** 구축. 메인/로그 영역은 손대지 않음.

**기능 범위**

-

**확장 훅(Feature Flags)**

- `context.frontMatter.enabled = false` (스키마/폼 렌더는 다음 단계)
- `context.tagging.enabled = false` (칩 인덱싱은 후속)
- `context.preview.enabled = true`
- `context.secrets.mode = "auto"`

**API v1**

- `POST /projects/:id/context/md`
  - body: `{ role: "primary"|"reference", file }`
- `POST /projects/:id/context/ingest` → `{ ingestion_id }`
- `GET  /projects/:id/context/preview?ingestion_id=...`
- `POST /projects/:id/context/secrets/scan`

**DB v1(추가)**

- `context_files(id, project_id, role, name, size, hash, storage_ptr, uploaded_at)`
- `context_ingestions(id, project_id, ingestion_meta_json, created_at)`

**완료 정의(DoD)**

- 업로드 순서 보존 & Full‑Read 검증 통과
- 동의 모달 흐름 정상(마스킹/무마스킹/취소)
- 미리보기 페이지에서 섹션/해시/토큰 확인 가능
- API/DB 초기 마이그레이션 반영
- 텍스트와 MD 내용이 상충할 경우 **MD 원문이 우선**한다.

### 4.2 구조 시각화(메인)

- **소스 파싱/색인**: JavaParser 등으로 AST 생성 → JSON/Graph로 저장
- **뷰**
  - 트리: 프로젝트 > 패키지 > 클래스 > 메서드/필드
  - 그래프: 호출 그래프/의존 관계(인바운드/아웃바운드)
  - 메트릭: 라인 수, 사이클로매틱 복잡도, 테스트 커버리지(옵션)
- **AI 편집 모드**
  - 선택 노드에 대해:
    - (1) 문제 설명/목표 지정 → (2) AI 제안 생성 → (3) Diff 미리보기 → (4) 적용 → (5) 자동 로그 작성
  - **안전 편집 가드**: 빌드/테스트 드라이런 → 실패 시 자동 **롤백** or 분기 브랜치로 격리

### 4.3 로그 & 분기점

- **로그 항목**: 시간, 대상 노드, 변경 요약, **왜**(근거/이슈 링크), 관련 테스트, 승인자(옵션)
- **분기점(Checkpoint)**
  - 단일 파일/폴더/전체 프로젝트 레벨 저장
  - **브랜치**: 분기점 기준 작업 분리, 병합 시 3-way diff 지원
  - **복구**: 단일 클릭 복구 + 변경 전후 Diff 미리보기
- **MD Export 템플릿(예)**

```markdown
# Change Log

## 2025-08-09 14:21 (+09:00)
- target: com.app.user.UserService#resetPassword
- what: add rate limiting and timeout
- why: prevent brute-force & hanging IO
- checkpoint: ckp_20250809_1421
```

---

### 4.3 그래프 뷰 (Obsidian 스타일) — v0.1

**목표**: 패키지/클래스 중심으로 전체 구성을 한눈에 파악. 기본 화면에서는 **코드 비노출**(이름만), `∨` 버튼으로 개별 노드의 **코드 펼침**.

**노드 레벨**

- **L1:** 패키지(클러스터)
- **L2:** 클래스(패키지 내부)
- **L3(옵션):** 메서드(클래스 더블클릭 시 확장)

**엣지 유형(토글 가능)**

- 코어 구조: `import/type-ref`, `call`, `extends/implements`, `override-of`
- 데이터/컨트롤: `field-ref(read|write)`, `throws`, `catches`, `thread-spawn`, `event-pub/sub`
- 프레임워크: `annotation-uses`, `di-wired`, `module-dep`
- 외부 I/O: `http-call`, `endpoint`, `db-access`, `fs-io`, `reflection`

> 기본 표시: `call + import/type-ref + extends/implements`. 나머지 유형은 필요 시 토글.

**외부 연동 표시**

- 휴리스틱 감지(패키지/어노테이션/타입/호출 그래프): 네트워크(`java.net`, `okhttp3`, `retrofit2`, `spring-web`, `@FeignClient`, `@RestController`), DB(`java.sql`, `JPA`, `spring-data`, `@Repository`), 파일(`java.io`, `nio`), MCP(`ai.mcp.*` 등)
- 색/아이콘(다크 테마 기준): 외부 연동 **청록 배지**, 위험/경계 **오렌지 경고 아이콘**
- 프로젝트 설정에서 룰 **추가/제외** 가능(정규식/패키지/어노테이션 기반)

**레이아웃/인터랙션**

- 레이아웃: Force-directed(물리 시뮬), 패키지별 **클러스터(컨벡스 헐)**
- 줌/팬: 휠 줌, 드래그 팬(터치 피치줌)
- 선택: 클릭→사이드패널(개요/참조/코드 탭), 더블클릭→**포커스 모드**(선택 노드 중심)
- 코드: 기본 비노출, 각 노드 `∨`로 Monaco 코드 뷰 **펼침**(읽기 전용)
- 검색: 이름/어노테이션/태그, **Path Finder**(A→B 최단 경로) 하이라이트
- 필터(재사용): `Intra-class / Intra-package / Inter-package` 스코프
- 노드 레벨 토글: L1/L2 기본, L3는 더블클릭 확장
- 미니맵: 우하단 토글

**시각 매핑(다크 테마)**

- 노드 크기: 기본=LOC(옵션: 커밋 빈도)
- 노드 색: 타입별 단계색, 외부 연동 **청록**, 위험 **오렌지**(명암 대비 4.5:1)
- 엣지 굵기: 호출 빈도/참조 수 비례, 스타일: `import`=점선, `call`=실선, `inherit`=삼각 화살표

**연결 깊이(Depth)**

- 기본: **전체 연결 표시(∞)**. 가독성/성능이 필요할 때만 Depth 슬라이더(옵션)로 시야를 좁힘.
- 연결 위치 규칙·알고리즘은 **별도 모듈로 분리**(후속 결정).

**성능/대규모 대응**

- LOD: 줌 아웃시 라벨→아이콘→클러스터 단계적 축소
- 온디맨드: 패키지 펼칠 때만 클래스/메서드 계산/렌더
- 물리 시뮬 제한: 5초 후 스냅샷 고정, 이동 시 재개
- 렌더러: WebGL(예: Cytoscape/Sigma/React Flow 조합)

**사이드패널(코드 비노출 기본)**

- 개요: 시그니처, LOC/복잡도, 외부 연동 배지, 최근 변경 요약
- 참조: what/why(컨텍스트 MD > 주석 > 수동 노트 순)
- 코드: `∨`로 펼침(읽기 전용)
- AI 작업: Explain / Plan / Edit with AI(선택 노드 범위 한정)

**CLI/모델 연동(프로바이더-중립)**

- 컨텍스트: 선택 노드 코드/시그니처 + 이웃 참조 최소 + **맥락 MD 전체(Full‑Read)**
- 모드: Explain(요약), Plan(계획), Patch(diff) — 범위 넘치면 거부

---

## 5) 아키텍처(초안)

- **프론트엔드**: React/Next.js, 상태(Zustand/Redux), 코드 뷰어(Monaco), 그래프(React Flow)
- **백엔드**: Node.js(Express/Fastify) 또는 Python(FastAPI)
- **파싱 서비스**: 언어별 모듈(우선 Java: JavaParser) → **AST JSON**
- **AI 오케스트레이터**: 프롬프트 템플릿, 컨텍스트 빌드, 토큰 최적화, 결과 Diff 생성
- **스토리지**
  - 프로젝트/파일/AST: DB(PostgreSQL) + 오브젝트 스토리지
  - 로그/분기점: DB + 스냅샷(압축)
  - 맥락 MD: 버전 관리(ADR 스타일)

**시퀀스(요약)**

1. 프로젝트 업로드 → 파서가 AST/그래프 생성
2. 노드 선택 → 컨텍스트 빌드 → AI 제안
3. Diff 확인 → 적용 → 테스트(옵션) → 성공 시 로그 + 분기점 생성
4. 필요 시 분기점 복구/브랜치 병합

---

## 6) 데이터 모델(요약)

- `projects(id, name, language, created_at, …)`
- `files(id, project_id, path, hash, content_ptr, …)`
- `ast_nodes(id, file_id, kind, name, range, parent_id, meta)`
- `graphs(project_id, edge: {from_node, to_node, type})`
- `logs(id, project_id, node_id, what, why, author, ts, checkpoint_id)`
- `checkpoints(id, project_id, scope, snapshot_ptr, parent_checkpoint_id)`
- `branches(id, project_id, name, base_checkpoint_id)`
- `contexts(id, project_id, md_ptr, tags, ts)`

---

## 7) API 설계(대략)

- `POST /projects` (생성/업로드) / `GET /projects/:id`
- `POST /projects/:id/parse` (AST/그래프 생성)
- `GET /projects/:id/structure` (트리/그래프 조회)
- `POST /nodes/:id/ai/suggest` (컨텍스트→AI 제안)
- `POST /nodes/:id/apply` (패치 적용 + 로그/분기점)
- `POST /checkpoints` / `POST /checkpoints/:id/restore`
- `GET /logs/export?format=md`

---

## 8) AI 프롬프트/가드(핵심)

- **프롬프트 구성(Full‑Read 기준)**: **맥락 MD(Primary) 전체** + 대상 노드 코드/시그니처 + 필요한 참조(최소) + 변경 목적/제약 + 출력 포맷(패치/테스트/설명).
- **절차**: *(1) 계획* — 변경 범위/영향 표 작성 → *(2) 패치* — **AST 경계 내** unified diff 생성 → *(3) 검증* — 드라이런/규칙 검사 → *(4) 로그/분기점* 자동 기록.
- **가드레일**:
  - 범위 제한: 선택 노드/파일 밖 편집 금지(가중 패널티 규칙).
  - 금지 패턴: 새 대형 의존성, 위험 API, 보안 취약 패턴.
  - 테스트 동반: 영향 영역 테스트 추가/수정 제안 필수.
  - 장문 코드 전략: 함수 추출/인터페이스 도입/호출 그래프 기준 세분화 제안 우선.

---

## 9) 언어 지원(1단계: Java)

- JavaParser로 **클래스/인터페이스/열거형/메서드/필드** 추출
- 제네릭/어노테이션/람다/레코드 처리
- **호출 그래프**: 메서드 간 호출/참조 링크 생성

---

## 10) MVP 범위(제안)

- Java 단일 프로젝트 업로드
- AST 트리 + 호출 그래프(읽기)
- 맥락 MD 업/다운로드 + YAML front-matter
- 노드 단위 AI 제안 → Diff → 적용
- 변경 로그 기록 + **분기점 생성/복구**
- 로그 **Markdown Export**

**비-MVP(다음 단계)**

- 브랜치 병합 3-way diff, 테스트 자동화, 다언어 지원, Git 연동, 권한/협업, CI 연동

---

## 11) 보안/프라이버시(개요)

- 업로드된 코드 암호화 저장, 토큰/시크릿 분리 관리
- **맥락 MD는 항상 전체 전송(Full‑Read 보장)**. 그 외 코드/로그/메타는 최소 컨텍스트 원칙으로 전송(민감정보 마스킹).

---

## 12) 성능/운영

- 대형 파일 가상 스크롤, AST 페이징 로드
- 스트리밍 인제스트(섹션 단위) & 세션 캐시(전체 MD)
- 장애 시 분기점 자동 생성 + 롤백 옵션

---

## 13) 오픈 이슈(결정 필요)

1. **스택**: FE(Next.js) + BE(Node vs Python) + Parser(Java) 확정
2. **분기점 저장 형식**: 파일 전체 스냅샷 vs 대상 노드 패치 로그
3. **Git 연동** 여부/시점(내장 분기점과의 조화)
4. **AI 모델**: 공급자/비용/토큰 한도/프롬프트 스타일 표준
5. **테스트 통합**: 빌드/테스트 러너 범위(JUnit 등)

---

## 14) 다음 단계 체크리스트

-

---

## 15) 와이어프레임(텍스트) v0.1

**컴포넌트 구상**

- 좌상단(맥락 패널): `ContextEditor(MD)`, `FrontMatterForm`, `MdUploadDownload`
- 좌중앙(구조 뷰): `FileTree`, `StructureGraph(React Flow)`, `CodePreview(Monaco)`, `NodeInspector`, `AiSuggestPanel`
- 우측(로그/분기점): `ChangeLogList`, `DiffPreview`, `CheckpointBar`, `ExportMarkdownBtn`

**주요 인터랙션 흐름**

1. 파일트리에서 클래스 선택 → `NodeInspector`에 메타/메트릭 표기
2. "AI 편집" 클릭 → `AiSuggestPanel`에서 목표/제약 입력 → 제안 생성
3. `DiffPreview`에서 패치 확인 → "적용" → 빌드 드라이런 → 성공 시 로그/분기점 자동 생성
4. 오류 시 분기점 복구 또는 브랜치 분리

---

## 16) ERD v0.1(세부)

**projects**(id UUID PK, name TEXT, language TEXT, repo\_url TEXT?, created\_at TIMESTAMPTZ, updated\_at TIMESTAMPTZ)

**files**(id UUID PK, project\_id FK→projects, path TEXT, hash TEXT, size INT, content\_ptr TEXT, created\_at TIMESTAMPTZ)

- IDX: (project\_id, path unique)

**ast\_nodes**(id UUID PK, file\_id FK→files, kind TEXT CHECK(kind IN('package','import','class','interface','enum','method','field')), name TEXT, fqcn TEXT, signature TEXT, start\_line INT, end\_line INT, parent\_id UUID NULL FK→ast\_nodes, meta JSONB, created\_at TIMESTAMPTZ)

- IDX: (file\_id), (fqcn), (kind,name), GIN(meta)

**graphs**(id UUID PK, project\_id FK→projects, from\_node UUID FK→ast\_nodes, to\_node UUID FK→ast\_nodes, type TEXT CHECK(type IN('call','ref','inherit','import')), created\_at TIMESTAMPTZ)

- IDX: (project\_id, type), (from\_node), (to\_node)

**logs**(id UUID PK, project\_id FK→projects, node\_id UUID FK→ast\_nodes NULL, what TEXT, why TEXT, diff\_ptr TEXT NULL, author TEXT NULL, ts TIMESTAMPTZ, checkpoint\_id UUID NULL FK→checkpoints)

- IDX: (project\_id, ts DESC)

**checkpoints**(id UUID PK, project\_id FK→projects, scope TEXT CHECK(scope IN('project','folder','file','node')), snapshot\_ptr TEXT, summary TEXT, parent\_checkpoint\_id UUID NULL FK→checkpoints, created\_at TIMESTAMPTZ)

**branches**(id UUID PK, project\_id FK→projects, name TEXT, base\_checkpoint\_id UUID FK→checkpoints, created\_at TIMESTAMPTZ)

**contexts**(id UUID PK, project\_id FK→projects, md\_ptr TEXT, tags TEXT[], ts TIMESTAMPTZ)

**ai\_jobs**(id UUID PK, project\_id FK→projects, node\_id UUID FK→ast\_nodes NULL, prompt\_ptr TEXT, result\_ptr TEXT, status TEXT CHECK(status IN('queued','running','succeeded','failed')), token\_in INT, token\_out INT, cost\_ms INT, ts TIMESTAMPTZ)

---

## 17) API 스펙 v0.1(요약 + 예시)

### 공통

- 헤더: `X-Project-Token`, `X-Request-Id`
- 에러 포맷:

```json
{"error": {"code": "INVALID_INPUT", "message": "...", "details": {}}}
```

### Projects

- `POST /projects` → {name, language} 업로드/생성

```json
// req
{"name":"demo","language":"java"}
// res
{"id":"prj_123","name":"demo","language":"java"}
```

- `POST /projects/:id/parse` → AST/그래프 생성 트리거
- `GET /projects/:id/structure?view=tree|graph` → 구조/그래프 조회

### Nodes & AI

- `POST /nodes/:id/ai/suggest`

```json
// req
{"goal":"메서드 타임아웃/재시도 추가","constraints":{"no_new_deps":true,"timeout_ms":2000}}
// res (요약)
{"patch": {"format":"unified","diff":"@@ ..."}, "rationale":"...", "tests":[{"file":"UserServiceTest.java","change":"add"}]}
```

- `POST /nodes/:id/apply` → 패치 적용 + 로그/분기점 생성

```json
{"patch": {"format":"unified","diff":"@@ ..."}, "log": {"what":"timeout added","why":"prevent hang"}, "checkpoint": {"scope":"file","summary":"timeout patch"}}
```

### Checkpoints & Logs

- `POST /checkpoints` / `POST /checkpoints/:id/restore`
- `GET /logs/export?format=md` → 로그 MD 다운로드

---

## 18) 체크포인트 스냅샷 설계 v0.1

- **저장소**: 오브젝트 스토리지(S3 호환). 스냅샷 = scope 기준 tar.gz + 메타(JSON)
- **ID 규칙**: `ckp_{YYYYMMDD_HHMM}_{short-hash}`
- **복구**: 미리보기 Diff → 승인 후 적용(파일 단위 교체). 실패 시 자동 롤백
- **정책**: 최근 N개 유지 + 중요한 스냅샷 `pinned=true`

---

## 19) AI 프롬프트 템플릿 v0.1

```
역할: 시니어 {language} 엔지니어
맥락:
- 프로젝트 요약: {front-matter}
- 대상 노드: {fqcn}#{symbol}
- 제약: {no_new_deps=true, timeout_ms=2000, style=google-java-format}

목표: {문제/개선 목표}
출력 형식(JSON):
{
  "patch": {"format": "unified", "diff": "..."},
  "rationale": "변경 이유와 트레이드오프",
  "tests": [{"file": "...", "change": "add|update"}]
}
가드레일: 보안 취약/성능 악화/스타일 위반 금지. 범위=선택 노드 내부.
```

## 19.1 프롬프트 전략 카탈로그 v0.1

- **맥락‑우선(Full‑Read)**: Primary MD 전체를 섹션 해시와 함께 순차 스트리밍하여 *실제로 모두 읽었음*을 검증.
- **단위‑편집(Scoped Patch)**: AST 경계 내에서만 수정. 금지 영역/파일 잠금 지원.
- **계획→패치 2단계**: 먼저 계획/영향 표를 생성·검토 후 diff 생성.
- **테스트 동반**: 영향 함수/경로 식별 → 테스트 추가·수정 제안.
- **긴 코드 분해**: 긴 메서드에 대해 함수 추출/모듈 분리/호출 그래프 기반 재배치.
- **검증 루프**: 빌드 드라이런/정적분석/린트/보안 규칙 자동 체크.

---

## 20) 보안/프라이버시 세부

- 시크릿 분리(.env/vault), 업로드 코드 **암호화 저장**, 민감 경로/키 마스킹
- AI 호출 시 **최소 컨텍스트 원칙** + PII 자동 탐지/제거(정규식/룰)
- 의존성 감사(취약점 스캔), 업로드 파일 크기/형식 제한

---

## 21) 운영/관측 베이스라인

- 로깅 필수 필드: ts, level, req\_id, project\_id, user, route, latency\_ms, result
- 메트릭: 요청 지연(p50/p95), 오류율, AST 빌드 시간, AI 제안 시간/토큰
- 트레이싱: parse→suggest→apply 체인 스팬, 실패 원인 태깅
- 피처 플래그: `ai.edit.enabled`, `checkpoint.auto`

---

## 22) MVP 일정(2주 스프린트 제안)

- **D1-2**: 리포/스택 스캐폴딩, ERD 초안, 업로드/프로젝트 생성
- **D3**: Parser PoC(Java→AST/그래프)
- **D4-5**: 구조 뷰 와이어프레임 + FileTree/Graph 베타
- **D6**: AI 제안 PoC(프롬프트/결과 수신)
- **D7-8**: Diff 적용 루프 + 로그 기록
- **D9**: 체크포인트 스냅샷/복구
- **D10**: 로그 MD Export + 기본 관측성
- **D11-12**: 하드닝(에러/성능), 버그바시
- **D13**: 사용자 피드백 수집(내부)
- **D14**: MVP 태그 릴리스

---

## 23) 결정 요청(빠른 선택 필요)

1. **백엔드 런타임**: FastAPI(파이썬, 파싱/AI 생태계 친화) vs Fastify(Node, JS 일관성).
2. **패치 포맷 기본값**: `unified diff`(휴먼 친화) vs `JSON patch`(머신 친화). → *unified 권장*.
3. **레포 구조**: 모노레포(앱/파서/오케스트레이터 한곳) vs 멀티레포. → *모노레포 권장*.

---

## 24) 리스크 & 완화

- **LLM 왜곡/오동작** → 범위 제한, 드라이런 빌드, 실패시 자동 롤백
- **대형 프로젝트 성능** → AST 페이징, 그래프 샘플링/가시 범위 제한
- **토큰/비용 급증** → 컨텍스트 최소화, 요약/캐시, 제안 크기 제한
- **의존성 취약점** → 정기 스캔, 서드파티 승인 절차

---

## 25) 용어 정의

- **분기점(Checkpoint)**: 복구 가능한 스냅샷 단위(프로젝트/폴더/파일/노드).
- **구조 시각화**: AST/호출 그래프를 이용한 계층/관계 뷰.
- **AI 제안 루프**: 컨텍스트→제안→Diff→적용→로그/분기점의 반복.

