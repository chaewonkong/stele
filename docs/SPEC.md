# 마크다운 메모앱 — 제품 스펙 (v1)

> 이 문서는 코딩 에이전트(예: Claude Code)에 그대로 입력해 구현을 진행하기 위한 스펙이다.
> 결정된 사항은 확정으로 취급하고, "오픈 이슈"로 표시된 항목만 구현 중 협의한다.

---

## 1. 한 줄 요약

macOS용 로컬 마크다운 메모 앱. 마크다운을 완전 지원하고, 한글 입력(IME)이 절대 깨지지 않으며,
설정 없이 실행 즉시 사용 가능하고, 미니멀하고 빠르게 뜬다. UI는 Bear / macOS 기본 메모 앱을 참고한다.

## 2. 왜 만드는가 (배경)

- Bear: 가볍지만 export 등 일부 기능이 유료.
- Obsidian: 무료·가볍지만 vault 설정 강제 + 워드프로세서에 가깝고 미니멀하지 않음.
- macOS 기본 메모: 마크다운을 제대로 지원하지 않음.

→ "vault 같은 설정 없이 즉시 쓰는, 마크다운 네이티브한, 미니멀한 메모 앱"을 직접 만든다.

## 3. 목표 (Goals)

1. macOS에 설치 가능한 GUI 앱 (앱스토어 출시 안 함, 로컬/개인 배포).
2. 마크다운 완전 지원 (편집 + 라이브 프리뷰).
3. 한글 입력 시 글자 유실·중복·조합 깨짐이 전혀 없을 것. **(하드 요구사항)**
4. 실행 즉시 사용 — vault/폴더 선택 같은 초기 설정 없음. 사용자는 데이터 저장 위치를 의식할 필요가 없다.
5. 미니멀하고 빠른 콜드 스타트.
6. DMG로 패키징해 배포 가능.

## 4. 비목표 (Non-goals, v1에서 안 함)

- 클라우드 동기화 / 멀티 디바이스 동기화.
- 협업 / 공유 / 권한 관리.
- 앱스토어 출시, 코드 서명·notarization (선택 항목으로만 문서화).
- 플러그인 시스템, 테마 마켓.
- Windows / Linux 빌드 (코드상 차단하진 않되 v1 검증 대상 아님).
- 백링크, 그래프 뷰, 위키링크 등 Obsidian식 지식관리 기능.
- 노트 검색 기능.
- 창 반투명(vibrancy/translucency) 효과.

---

## 5. 기술 스택 (확정)

| 영역 | 선택 | 비고 |
|---|---|---|
| 런타임 | **Wails v2** | WKWebView 사용 → 작은 번들, 빠른 시작, macOS 네이티브 IME 위임 |
| 백엔드 | **Go** | 파일/DB I/O, 비즈니스 로직 |
| 프론트엔드 | **React + TypeScript** | `wails init -t react-ts` 기반 |
| 빌드 | Vite (Wails 기본) | |
| 에디터 | **CodeMirror 6** | `@codemirror/lang-markdown` (Lezer 파서) 기반 |
| 저장소 | **SQLite** | 단일 DB 파일 |
| 스타일 | **Tailwind CSS** | |

**런타임 선택 근거 요약:** macOS에서는 Wails/Tauri 모두 동일한 WKWebView를 써서 체감 속도가 사실상 같다.
Electron은 잘 만들면 빠르지만(VSCode) 그 최적화를 직접 재현해야 하고 번들·기본 메모리 비용이 크다.
Tauri는 백엔드가 Rust라 유지보수 언어 풀(JS/TS·React·Node·Go) 밖. → 풀 안 + 성능 + 네이티브 IME를
동시에 만족하는 Wails v2로 확정. (Wails v3는 2026년 기준 alpha라 v1에서는 채택 안 함.)

---

## 6. 데이터 모델 (확정)

DB 파일 위치: `~/Library/Application Support/<AppName>/notes.db`
(사용자에게 노출하지 않음. 앱이 알아서 생성·관리.)

### 6.1 스키마

```sql
CREATE TABLE notes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL DEFAULT '',   -- 본문 첫 헤딩/첫 줄에서 자동 추출
  body        TEXT NOT NULL DEFAULT '',   -- 마크다운 원문 (진실의 원천)
  preview     TEXT NOT NULL DEFAULT '',   -- 사이드바용 본문 앞부분 캐시 (마크다운 기호 제거)
  pinned      INTEGER NOT NULL DEFAULT 0, -- 0/1
  created_at  INTEGER NOT NULL,           -- unix epoch (ms)
  updated_at  INTEGER NOT NULL,           -- unix epoch (ms)
  deleted_at  INTEGER                     -- NULL이면 활성, 값 있으면 휴지통
);

CREATE INDEX idx_notes_updated   ON notes(updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_notes_pinned    ON notes(pinned DESC, updated_at DESC) WHERE deleted_at IS NULL;
```

### 6.2 규칙

- `title`은 저장 시 본문에서 자동 추출한다: 첫 번째 `#` 헤딩 → 없으면 첫 비어있지 않은 줄 → 없으면 "Untitled".
- `preview`는 본문 앞 ~120자에서 마크다운 기호를 제거한 평문.
- 삭제는 **soft delete**(휴지통). 영구 삭제(`PurgeNote`)는 사용자가 명시적으로 요청할 때만.
- 태그 기능은 v1 비목표지만, 나중에 `tags` / `note_tags` 테이블만 추가하면 되도록 스키마를 침범하지 않게 둔다.

### 6.3 Export

- **단일 export:** 현재 노트를 `.md` 파일로 저장 (네이티브 저장 다이얼로그).
- **전체 export:** 사용자가 고른 폴더에 모든 활성 노트를 `<title>.md`로 일괄 추출 (파일명 충돌 시 `-1`, `-2` 등 접미사).
- export는 읽기 동작이며 DB를 변경하지 않는다.

---

## 7. 백엔드 API (Go ↔ JS 바인딩)

Wails 바인딩으로 프론트에 노출할 메서드(시그니처는 가이드이며 구현 시 조정 가능):

```
ListNotes(includeTrashed bool) ([]NoteSummary, error)
  // NoteSummary = { id, title, preview, pinned, updatedAt }
  // 정렬: pinned DESC, updatedAt DESC

GetNote(id int64) (Note, error)
  // Note = { id, title, body, pinned, createdAt, updatedAt }

CreateNote() (Note, error)        // 빈 노트 생성 후 반환 (즉시 편집 진입용)
UpdateNote(id int64, body string) (NoteSummary, error)
  // title/preview 재추출, updated_at 갱신

TogglePin(id int64, pinned bool) error
TrashNote(id int64) error         // soft delete
RestoreNote(id int64) error
PurgeNote(id int64) error         // 영구 삭제 (명시적 확인 후)

ExportNote(id int64) error        // 저장 다이얼로그
ExportAll() error                 // 폴더 선택 다이얼로그
```

**자동 저장:** 프론트가 입력 멈춤 기준 디바운스(권장 500ms)로 `UpdateNote`를 호출한다.
저장은 현재 body 문자열을 읽어 보내기만 하므로 IME 조합 상태에 영향을 주지 않는다(8.4 참고).

---

## 8. 에디터 (스펙의 핵심)

CodeMirror 6 + `@codemirror/lang-markdown`. Lezer 구문 트리를 이용해 decoration을 계산한다.

### 8.1 표시 방식 = Bear형 "마커 유지 + 스타일링"

- 마크다운 마커(`#`, `**`, `*`, `` ` ``, `>`, `-` 등)는 **숨기지 않고 유지**하되, CSS로 흐리게/작게 처리.
- 본문은 **mark decoration**(스타일만 입힘, 텍스트 비파괴)으로 굵게/기울임/제목/인라인코드/링크/인용 등을 렌더.
- 마커를 커서 위치에 따라 숨겼다 보였다 하는 Typora/Obsidian식 완전 WYSIWYG은 **v1 비목표**(IME 리스크↑).
- 이유: mark decoration은 텍스트 범위를 건드리지 않아 한글 조합에 가장 안전하다.

### 8.2 블록 위젯 — 체크박스 (v1 포함)

- `- [ ]` / `- [x]` 를 클릭 가능한 체크박스 위젯으로 렌더.
- 클릭 시 소스의 `[ ]` ↔ `[x]` 를 dispatch로 토글.
- 체크박스 라인 안에서 한글을 조합할 일이 없어 리스크 낮음. (마커 유지 원칙의 의도된 예외)

### 8.3 블록 위젯 — 표 (v1 포함, 단 아래 원칙 준수)

**핵심 원칙: 렌더는 커서가 표 블록 밖일 때만, 입력은 항상 순수 마크다운 소스에서.**

- 커서가 파이프 표 블록 **밖**: 읽기 전용 `<table>` 위젯으로 렌더(정렬·가벼운 보더).
- 커서가 표 블록 **안**: 원문 파이프 텍스트를 펼쳐 평범한 CM6 텍스트로 편집.
- 렌더된 셀 안에서 직접 타이핑하는 방식(커스텀 contenteditable)은 **금지** — CM6의 IME 처리를 우회해 한글이 깨지는 전형적 케이스.
- 따라서 실제 글자 입력은 항상 CM6 소스에서 일어나며, 표 렌더 위젯은 커서가 없을 때만 존재 → IME와 충돌하지 않는다.

### 8.4 한글 IME 가드 (전 구현에 공통, 위반 시 버그로 간주)

1. **조합 중 decoration 재계산/치환 금지.** `view.composing`(또는 이벤트의 `isComposing`)이 true인 동안에는
   replace/widget decoration을 새로 적용하거나 조합 범위에 닿는 갱신을 하지 않는다. mark 스타일 갱신도 조합 종료 후로 미룬다.
2. **커스텀 키바인딩은 조합 중 패스.** 단축키 핸들러는 진입 즉시 `if (e.isComposing) return;` (혹은 keyCode 229 체크)로 빠져 IME 입력을 가로채지 않는다.
3. **자동 저장은 비파괴 읽기만.** 디바운스 저장은 현재 문서 문자열을 읽어 전송할 뿐 에디터 상태를 바꾸지 않는다. 가능하면 `compositionend` 이후로 저장 트리거를 정렬.
4. **위젯/atomic 범위를 조합 지점 근처에 두지 않는다.** 표·체크박스 위젯은 커서/조합이 없는 위치에서만 활성.

### 8.5 마크다운 지원 범위 (v1)

지원: 제목(H1–H6), 굵게/기울임/취소선, 인라인 코드, 코드블록(펜스), 인용, 순서/비순서 목록,
체크박스 목록, 링크, 수평선, 표.
v1 비목표: 각주, 수식(LaTeX), 다이어그램(mermaid), 이미지 인라인 렌더(텍스트 링크로만 두고 v2 검토).

---

## 9. UX / UI 요구사항

- 2-pane 레이아웃: **좌측 사이드바(노트 리스트) + 우측 에디터.** Bear / macOS 메모 앱 참고.
- 사이드바 항목 = **제목 + 본문 미리보기 일부**(2줄 내외) + 갱신시각/핀 표시.
- 사이드바 정렬: 핀 고정 먼저, 그다음 최근 수정순.
- 새 노트: 단축키(예: ⌘N) + 버튼. 생성 즉시 에디터 포커스.
- 핀/휴지통 이동/복원/영구삭제 동작 제공. 영구삭제는 확인 다이얼로그.
- 미니멀한 비주얼: 불필요한 툴바/장식 최소화.
- macOS 네이티브감: 창 트래픽 라이트, 적절한 여백.

---

## 10. 성능 요구사항

- **콜드 스타트:** 목표 < 1.0s, 허용 < 1.5s (M2 MacBook Air 기준).
- **타이핑 지연:** 체감되지 않는 수준. 한글 연속 입력 시 프레임 드랍/지연 없음.
- **앱 번들:** 가능한 작게(Wails 특성상 수십 MB 이내 목표).
- decoration 계산은 뷰포트 범위만 대상으로 하고 incremental하게.

---

## 11. 배포

- **v1: 미서명 로컬 DMG 배포.** `wails build`로 `.app` 생성 → DMG 패키징.
- 설치 시 macOS Sequoia(15+)에서는 한 번 실행 시도 → "열 수 없음" 경고 → 시스템 설정 > 개인정보 보호 및 보안 하단에서 "그래도 열기" → 관리자 인증. (이후 실행에는 경고 없음. Control-클릭 우회는 Sequoia에서 제거됨.)
- **선택(남에게 배포 시):** Apple Developer ID 서명 + notarization. v1 필수 아님, 문서로만 남김.

---

## 12. 마일스톤

- **M0 — 스캐폴드:** Wails v2 + react-ts 프로젝트 생성, 빌드/실행 확인, DMG 패키징 파이프라인 1회 통과.
- **M1 — 데이터 계층:** SQLite 스키마 + 인덱스, Go API(CRUD/export) 구현 및 단위 테스트.
- **M2 — 기본 UI:** 2-pane 레이아웃, 사이드바 리스트(제목+프리뷰), 노트 생성/선택/자동저장, 핀/휴지통.
- **M3 — 에디터 코어:** CM6 + lang-markdown, Bear형 mark 스타일링, **한글 IME 가드 + 수용 기준 통과**.
- **M4 — 블록 위젯:** 체크박스, 표(커서-인지 렌더/소스 편집).
- **M5 — export·마감:** export 2종, 성능 점검, 콜드 스타트 최적화.

각 마일스톤은 다음 단계 진입 전 13절 수용 기준 중 해당 항목을 통과해야 한다.

---

## 13. 수용 기준 (Acceptance Criteria)

### 13.1 한글 IME (최우선, 자동/수동 테스트 모두)

- [ ] "안녕하세요"를 빠르게 입력해도 글자 유실/중복/순서 뒤바뀜이 없다.
- [ ] 받침 조합·분리(예: "갑" → "가비"처럼 다음 글자로 넘어가는 케이스)가 정상 동작한다.
- [ ] 조합 중 자동저장 디바운스가 발생해도 조합이 깨지지 않는다.
- [ ] 커스텀 단축키(⌘B 등)가 한글 조합 중 입력을 가로채지 않는다.
- [ ] 표/체크박스 근처에서 한글을 입력해도 위젯 갱신으로 caret이 튀지 않는다.
- [ ] 긴 노트(수천 줄)에서도 한글 입력 지연이 없다.

### 13.2 기능

- [ ] 앱을 처음 실행하면 별도 설정 없이 바로 새 노트를 작성할 수 있다.
- [ ] 사이드바가 제목 + 본문 미리보기로 노트를 보여주고, 핀/최근수정 순으로 정렬된다.
- [ ] 마크다운 마커가 유지된 채 Bear형으로 스타일링된다.
- [ ] 체크박스를 클릭하면 소스의 `[ ]`/`[x]`가 토글된다.
- [ ] 표가 커서 밖에서는 렌더되고, 커서가 들어오면 파이프 소스로 편집된다.
- [ ] 단일/전체 export가 정상 `.md`를 만든다.
- [ ] 휴지통 이동/복원이 동작하고, 영구삭제는 확인 후에만 실행된다.

### 13.3 성능/배포

- [ ] 콜드 스타트가 목표 시간 내.
- [ ] DMG로 패키징되고, 미서명 상태에서 Sequoia 절차로 실행 가능.

---

## 14. 오픈 이슈 (구현 중 결정)

- **OI-1 이미지 인라인 렌더:** v1은 텍스트 링크 유지, v2 검토.
- **OI-2 표 편집 UX 디테일:** 커서-인지 렌더 전환 시 깜빡임 최소화 방법.

---

## 15. 향후(v2+) 후보

- 라이브 프리뷰 완전 WYSIWYG(커서 떠나면 마커 숨김).
- 이미지 인라인 렌더 및 첨부 저장.
- 태그/폴더, 정렬 옵션 확장.
- 수식·다이어그램.
- 코드 서명 + notarization 기반 공개 배포.