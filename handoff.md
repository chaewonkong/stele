# Handoff — stele M4 블록 위젯

## 현재 상태

M0~M3 완료. M4 진행 중.

- Go 백엔드: sqlc 기반 SQLite CRUD, Wails 바인딩 완성
- 프론트엔드: 2-pane UI, CM6 에디터 (Bear형 decoration + 한글 IME 가드 + 자동저장)
- **체크박스 위젯**: 완료
- **표 위젯**: 미완 (렌더 안됨, 원인 조사 필요)
- **기존 버그**: 저장된 메모 클릭 시 에디터에 열리지 않음 (미조사)

---

## M4 완료된 것

### 체크박스 위젯 (완료)

`frontend/src/components/Editor.tsx`에 구현 완료.

- GFM 파서 활성화: `markdown({ base: markdownLanguage })` — `markdownLanguage`는 `@codemirror/lang-markdown`에서 import
  - 기존 `markdown()`은 CommonMark only로 `TaskMarker`·`Table` Lezer 노드가 생성되지 않았음
- `CheckboxWidget`: `TaskMarker` Lezer 노드를 `Decoration.replace`로 `<input type="checkbox">`로 교체
  - `ignoreEvent() = true`, `onmousedown`에서 `[ ]`↔`[x]` dispatch
  - IME 가드: `view.composing` 시 rebuild 스킵
- ListMark(`-`) 숨김: `TaskMarker` 발견 시 ancestor `ListItem.firstChild(ListMark)`를 찾아 `[ListMark.from, TaskMarker.from]` 구간을 `Decoration.replace({})` 로 숨김
- Enter 키 커스텀 핸들러 (`taskListEnter`):
  - `Prec.highest(keymap.of([{ key: 'Enter', run: taskListEnter }]))`로 등록 (markdown keymap보다 우선)
  - 내용 있는 task + Enter → 새 `- [ ] ` 줄 생성
  - 빈 task + Enter → 마커 제거 후 일반 줄로 탈출
- CSS: `.cm-task-checkbox` (`frontend/src/style.css`)

### 변경된 파일

| 파일 | 변경 내용 |
|------|-----------|
| `frontend/src/components/Editor.tsx` | GFM 파서, CheckboxWidget, TableWidget(미완), taskListEnter |
| `frontend/src/style.css` | `.cm-task-checkbox`, `.cm-table-widget`, `.cm-md-table` |

---

## M4 미완 — 표 위젯

### 구현한 것

`TableWidget` + `tablePlugin` 코드는 `Editor.tsx`에 존재.

```typescript
// buildTableDecorations 핵심 로직
const startLine = view.state.doc.lineAt(node.from)
const endLine = view.state.doc.lineAt(node.to)
builder.add(
  startLine.from,
  endLine.to,
  Decoration.replace({ widget: new TableWidget(source, node.from), block: true }),
)
```

- 커서가 표 밖: `block: true` replace decoration으로 `<table>` 위젯 치환 시도
- 커서가 표 안: decoration 없음 → 소스 편집
- 클릭 시: `cursor → tableFrom` dispatch → 소스 노출
- IME 가드: `view.composing` 시 rebuild 스킵, `selectionSet` 트리거

### 증상

표를 입력해도 파이프 소스(`| A | B |` 등)가 그대로 보임. 위젯이 렌더되지 않음.

### 의심 원인 및 다음 시도할 것

1. **trailing newline 미포함**: `endLine.to`는 줄 마지막 문자 위치(newline 미포함). CM6 block decoration이 trailing newline을 포함해야 동작할 수 있음.
   - 시도: `endLine.to < doc.length ? endLine.to + 1 : endLine.to`

2. **ViewPlugin → StateField 전환**: CM6에서 block decoration은 `StateField`에서 제공하는 것이 더 안정적일 수 있음.
   ```typescript
   import { StateField } from '@codemirror/state'
   const tableField = StateField.define<DecorationSet>({
     create: (state) => buildTableDecorations(state),
     update: (deco, tr) => { /* rebuild on change/selection */ },
     provide: f => EditorView.decorations.from(f),
   })
   ```

3. **DevTools 확인**: `wails dev` 실행 후 WebKit Inspector에서 `.cm-table-widget` DOM 존재 여부 확인. DOM이 없으면 decoration 자체가 적용 안 됨.

4. **`Decoration.replace` + `block: true` side 옵션**: `side: -1` 또는 `side: 1` 명시 필요 가능성.

5. **markdownDecorations와 충돌**: 표 내부 셀의 mark decoration이 `replace` decoration과 충돌 가능성 (낮음, 다른 DecorationSet이라 보통은 replace가 우선).

---

## 기존 버그 — 저장된 메모 클릭 시 에디터 미열림

### 증상

사이드바에서 기존 메모를 클릭해도 에디터에 내용이 열리지 않음. 앱 재시작 또는 새 메모 생성 후에는 정상.

### 미조사. 추정 원인

- `App.tsx`의 `onNoteSelect` → `noteId` state 업데이트 → `Editor.tsx` `useEffect([noteId])` 흐름 중 문제
- `GetNote(noteId)` 호출 실패 또는 `cancelled` 플래그 문제
- `viewRef.current?.destroy()` 타이밍 이슈

---

## 핵심 제약 (위반 시 버그)

### 한글 IME 가드 (SPEC §8.4)
1. `view.composing === true` 동안 decoration 재계산/치환 금지
2. 커스텀 키바인딩: `if (e.isComposing) return;` 진입 즉시 패스
3. 자동저장: `bodyRef.current` 읽기만 → 에디터 상태 변경 금지
4. 표·체크박스 위젯은 커서/조합이 없는 위치에서만 활성

### 에디터 렌더 방식 (SPEC §8.1)
- Bear형: 마커 유지 + mark decoration (스타일만, 텍스트 비파괴)
- replace/widget decoration은 조합 범위 근처에 적용 금지

---

## 오픈 이슈

- **OI-T**: 표 렌더 미동작 (위 참고)
- **OI-B**: 저장된 메모 클릭 시 에디터 미열림 (위 참고)
- **OI-2**: 표 렌더 전환 시 깜빡임 최소화 (표 동작 후 검토)
- **OI-1**: 이미지 인라인 렌더 — v1은 텍스트 링크 유지
