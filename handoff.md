# Handoff — stele M4 블록 위젯

## 현재 상태

M0~M3 완료. M4 진행 중.

- Go 백엔드: sqlc 기반 SQLite CRUD, Wails 바인딩 완성
- 프론트엔드: 2-pane UI, CM6 에디터 (Bear형 decoration + 한글 IME 가드 + 자동저장)
- **체크박스 위젯**: 완료
- **표 위젯**: 완료 (StateField로 block decoration 제공)
- **기존 버그**: 저장된 메모 클릭 시 미열림 → 해결 (표 버그와 동일 원인)

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
| `frontend/src/components/Editor.tsx` | GFM 파서, CheckboxWidget, TableWidget/tableField, taskListEnter |
| `frontend/src/style.css` | `.cm-task-checkbox`, `.cm-table-widget`, `.cm-md-table` |

---

## M4 표 위젯 (완료)

`TableWidget` + `tableField`(StateField)로 `Editor.tsx`에 구현.

```typescript
// buildTableDecorations 핵심 로직 (StateField 기반)
const tableField = StateField.define<DecorationSet>({
  create: (state) => buildTableDecorations(state),
  update: (deco, tr) =>
    tr.docChanged || tr.selection ? buildTableDecorations(tr.state) : deco.map(tr.changes),
  provide: (f) => EditorView.decorations.from(f),
})
// Table 노드를 node.from~node.to 범위로 block replace
builder.add(node.from, node.to,
  Decoration.replace({ widget: new TableWidget(source, node.from), block: true }))
```

- 커서가 표 밖: `block: true` replace decoration으로 `<table>` 위젯 치환
- 커서가 표 안: decoration 없음 → 소스 편집
- 클릭 시: `cursor → tableFrom` dispatch → 소스 노출
- IME 가드: 표 위젯은 커서 없는 위치에만 렌더 → 조합(커서가 셀 안 = 소스 노출)과
  겹치지 않으므로 `composing` 가드 불필요

### 핵심 교훈 (다음 위젯 작업 시 주의)

**block decoration / 줄바꿈을 가로지르는 replace decoration은 `ViewPlugin`에서 제공
불가.** CM6가 `RangeError("Block decorations may not be specified via plugins")`를 throw함.
반드시 `StateField`로 제공해야 함. (단일 라인 내 inline replace인 체크박스는 ViewPlugin 가능.)

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

- ~~**OI-T**: 표 렌더 미동작~~ → 해결 (ViewPlugin → StateField)
- ~~**OI-B**: 저장된 메모 클릭 시 미열림~~ → 해결 (OI-T와 동일 원인)
- **OI-2**: 표 렌더 전환 시 깜빡임 최소화 (표 동작 후 검토)
- **OI-1**: 이미지 인라인 렌더 — v1은 텍스트 링크 유지
