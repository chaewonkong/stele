# Handoff — stele M4 블록 위젯

## 현재 상태

M0~M3 완료. 앱이 실행되고 CM6 에디터가 마크다운을 Bear형으로 렌더한다.
- Go 백엔드: sqlc 기반 SQLite CRUD, Wails 바인딩 완성
- 프론트엔드: 2-pane UI, CM6 에디터 (Bear형 decoration + 한글 IME 가드 + 자동저장)
- 미완: 체크박스 위젯, 표 커서-인지 렌더

## M3 완료된 것

- `Editor.tsx`: textarea → CM6 EditorView 교체
- Bear형 mark decoration: H1~H6, bold, italic, strike, inline-code, code-block, blockquote, list-mark, link, hr
- 한글 IME 가드: ViewPlugin.update()에서 `view.composing` 체크, compositionend 저장 정렬
- 자동저장: updateListener(docChanged) + compositionend 이중 트리거 (500ms 디바운스)
- history + defaultKeymap + historyKeymap (undo/redo)

## M4 목표

체크박스 위젯과 표 커서-인지 렌더. SPEC §8.2, §8.3 참고.

## 작업 범위

### 1. 체크박스 위젯 (SPEC §8.2)

`- [ ]` / `- [x]`를 클릭 가능한 체크박스 위젯으로 렌더.
- `WidgetType`으로 체크박스 DOM 생성
- 클릭 시 dispatch로 `[ ]` ↔ `[x]` 토글
- 체크박스 라인 안에서 커서가 있어도 위젯 활성 가능 (IME 리스크 낮음 — 의도된 예외)

### 2. 표 커서-인지 렌더 (SPEC §8.3)

핵심 원칙: 커서가 표 블록 **밖**일 때만 `<table>` 위젯으로 렌더, 커서가 **안**이면 파이프 소스 편집.

- 커서 위치 추적: `update.state.selection.main.head`로 현재 커서 라인 계산
- 파이프 표 블록 감지: Lezer `Table` 노드 (`@lezer/markdown`)
- 커서 밖: `replace` decoration으로 `<table>` 위젯 치환
- 커서 안: decoration 제거 → 원문 파이프 텍스트로 복귀
- **절대 금지**: 렌더된 셀 안에서 직접 타이핑 (CM6 IME 우회 → 한글 깨짐)

### 3. IME 가드 유지

- 표 위젯: 커서가 표 블록 밖일 때만 활성 → IME와 충돌 없음
- 체크박스: 클릭 이벤트만 처리, 텍스트 입력은 CM6 소스에서

## 핵심 파일

| 파일 | 역할 |
|------|------|
| `frontend/src/components/Editor.tsx` | CM6 에디터, 위젯 플러그인 추가 위치 |
| `frontend/src/style.css` | `.md-*` Bear형 데코레이션 CSS |
| `docs/SPEC.md` §8.2~§8.3 | 위젯 상세 스펙 |

## 오픈 이슈

- OI-2: 표 렌더 전환 시 깜빡임 최소화 (M4에서 해결)
- OI-1: 이미지 인라인 렌더 — v1은 텍스트 링크 유지
