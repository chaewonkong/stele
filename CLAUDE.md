# stele

macOS용 로컬 마크다운 메모 앱. 상세 스펙은 `docs/SPEC.md` 참고.

## 기술 스택

- **런타임**: Wails v2.12.0 (WKWebView, macOS 네이티브 IME)
- **백엔드**: Go 1.25 + `modernc.org/sqlite` (CGO 불필요) + sqlc v1.31.1
- **프론트엔드**: React 18 + TypeScript 5 + Vite 6
- **에디터**: CodeMirror 6 + `@codemirror/lang-markdown` (M3~)
- **스타일**: Tailwind CSS v4
- **패키지 매니저**: pnpm

## 디렉토리 구조

```
stele/
├── main.go              # Wails 앱 진입점 (macOS hidden-inset 타이틀바)
├── app.go               # Wails 바인딩 (Go ↔ JS), export 다이얼로그
├── models.go            # Note, NoteSummary 타입
├── store.go             # DB 초기화·마이그레이션·CRUD, extractTitle/extractPreview
├── store_test.go        # 단위 테스트 (8개)
├── sqlc.yaml            # sqlc 설정
├── sql/
│   ├── schema.sql       # DB 스키마 (진실의 원천)
│   └── query.sql        # sqlc 쿼리 정의
├── db/                  # sqlc 자동 생성 (수정 금지)
│   ├── db.go
│   ├── models.go
│   └── query.sql.go
├── wails.json           # Wails 빌드 설정 (pnpm 사용)
├── go.mod / go.sum
├── docs/
│   └── SPEC.md
└── frontend/
    ├── src/
    │   ├── main.tsx
    │   ├── App.tsx          # 상태 관리 + 레이아웃
    │   ├── style.css        # Tailwind v4 진입점
    │   └── components/
    │       ├── Sidebar.tsx  # 노트 목록, 핀/휴지통/export 액션 (hover pill 툴바)
    │       └── Editor.tsx   # CM6 EditorView (Bear형 decoration + IME 가드)
    ├── wailsjs/             # Wails 자동 생성 (수정 금지)
    ├── package.json
    ├── vite.config.ts
    └── tsconfig.json
```

## 개발 명령어

```bash
# 개발 서버 (핫 리로드)
wails dev

# 프로덕션 빌드 (.app 생성)
wails build

# DMG 패키징
wails build -platform darwin/arm64

# Go 테스트
cd stele && go test ./...

# sqlc 재생성 (sql/ 변경 후)
sqlc generate
```

## 데이터 저장

- DB 위치: `~/Library/Application Support/stele/notes.db`
- 사용자에게 노출하지 않음. 앱이 자동 생성·관리.
- Soft delete: `deleted_at` 필드. 영구 삭제는 `PurgeNote`만.

## 마일스톤

- [x] **M0** — 스캐폴드: Wails v2 + react-ts, pnpm, Tailwind v4, CM6 deps
- [x] **M1** — 데이터 계층: sqlc + SQLite 스키마, Go CRUD/export API, 단위 테스트 8개
- [x] **M2** — 기본 UI: 2-pane 레이아웃, 사이드바(핀/휴지통), textarea 에디터, 자동저장
- [x] **M3** — 에디터 코어: CM6 + lang-markdown, Bear형 mark 스타일링, **한글 IME 가드**
- [x] **M4** — 블록 위젯: 체크박스 토글, 표 커서-인지 렌더, macOS 윈도우 크롬(신호등/드래그) + IME 깨짐 수정
- [ ] **M5** — export·마감: **단일 노트 export UI 완료** (전체 export는 비제공 결정), 성능 점검·콜드 스타트 최적화·DMG 배포 남음

## 핵심 제약 (위반 시 버그)

### 한글 IME 가드 (SPEC §8.4)
1. **`view.composing === true` 동안 decoration "재계산(rebuild)" 금지.** 단 **동결(freeze)은 금물** —
   replace/block decoration을 그냥 멈추면 위 줄에 글자 삽입 시 치환 범위가 옛 위치에 stale로 남아
   줄 결합·엉뚱한 위치 입력 등 깨짐 발생. 조합 중에는 **`decorations.map(changes)`로 위치만 갱신**하고,
   재계산은 `compositionend`(비조합 트랜잭션) 이후로 미룸. (mark는 비파괴라 동결해도 무증상이지만 동일 규칙 적용)
2. **커스텀 키바인딩**: `if (e.isComposing) return;` 진입 즉시 패스
3. **자동저장**: `bodyRef.current` 읽기만 → 에디터 상태 변경 금지. `compositionend` 이후 저장 정렬 권장
4. **위젯**: 표·체크박스 위젯은 커서/조합이 없는 위치에서만 활성 (커서 있는 줄은 소스 노출)
5. **keymap 명령은 조합 중 Enter를 건너뜀.** task 리스트 자동 이어쓰기처럼 IME 중에도 동작해야 하는 건
   keymap이 아니라 **`EditorState.transactionFilter`**로 처리. 필터에서 `[tr, extra]` 반환 시 extra의
   좌표가 post-tr이면 반드시 **`sequential: true`** (없으면 startState 좌표로 해석돼 위치가 어긋남).

### 에디터 렌더 방식 (SPEC §8.1)
- Bear형: 마커(`#`, `**`, `` ` `` 등) 유지 + **mark decoration**(스타일만, 텍스트 비파괴)
- Typora/Obsidian식 완전 WYSIWYG(커서 떠나면 마커 숨김) → v1 비목표, IME 리스크 높음
- replace/widget decoration은 조합 범위 근처에 적용 금지

### macOS 윈도우 크롬
- `main.go`는 `TitleBarHiddenInset()` 사용 → 신호등이 콘텐츠 위에 떠 있음.
- `App.tsx` 최상단에 신호등 전용 **드래그 바**(`h-9`, `bg-gray-50`, `--wails-draggable: drag`)를 두고
  사이드바/에디터를 그 아래로 배치 → 신호등이 헤더/버튼과 겹치지 않음. 드래그 영역 내 버튼은 `no-drag`.

