# Handoff — stele M4 블록 위젯

## 현재 상태

M0~M4 완료. (M5 = export·마감 남음)

- Go 백엔드: sqlc 기반 SQLite CRUD, Wails 바인딩 완성
- 프론트엔드: 2-pane UI, CM6 에디터 (Bear형 decoration + 한글 IME 가드 + 자동저장)
- **체크박스 위젯**: 완료 (커서-인지, IME 안전)
- **표 위젯**: 완료 (StateField로 block decoration 제공)
- **macOS 윈도우 크롬**: 신호등 전용 상단 드래그 바 + 창 드래그 (OI-W1/W2 해결)
- **IME 깨짐**: 체크박스/표 입력 시 줄 결합·오삽입, 한글 task+Enter 모두 해결 (OI-W3/W4)
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
1. 조합 중 decoration **재계산(rebuild) 금지, 단 동결(freeze)도 금지** — replace/block은
   `decorations.map(changes)`로 위치만 갱신(동결 시 stale 범위로 줄 깨짐). 재계산은 조합 종료 후.
2. 커스텀 키바인딩: `if (e.isComposing) return;` 진입 즉시 패스
3. 자동저장: `bodyRef.current` 읽기만 → 에디터 상태 변경 금지
4. 표·체크박스 위젯은 커서/조합이 없는 위치에서만 활성 (커서 줄은 소스 노출)
5. keymap은 조합 중 Enter를 스킵 → IME 중에도 동작할 동작은 `transactionFilter`로
   (`[tr, extra]` 반환 시 extra는 `sequential: true` 필수)

### 에디터 렌더 방식 (SPEC §8.1)
- Bear형: 마커 유지 + mark decoration (스타일만, 텍스트 비파괴)
- replace/widget decoration은 조합 범위 근처에 적용 금지

---

## 오픈 이슈

- ~~**OI-T**: 표 렌더 미동작~~ → 해결 (ViewPlugin → StateField)
- ~~**OI-B**: 저장된 메모 클릭 시 미열림~~ → 해결 (OI-T와 동일 원인)
- **OI-2**: 표 렌더 전환 시 깜빡임 최소화 (표 동작 후 검토)
- **OI-1**: 이미지 인라인 렌더 — v1은 텍스트 링크 유지

### 신규 제보 (해결)

- ~~**OI-W1 (타이틀바 가림)**~~ → 해결. (통합형 좌측 패딩 2회 실패 → 접근 변경)
  `App.tsx` 최상단에 **신호등 전용 드래그 바**(`h-9`, 전폭, `bg-gray-50`, `--wails-draggable: drag`)
  추가. 사이드바와 동일 회색으로 통일해 흰 띠처럼 보이지 않게 함. 사이드바/에디터를 그 아래
  flex row로 내려 신호등과 기능 요소(메모 타이틀·+/휴지통 버튼)가 겹치지 않음. Sidebar 헤더는
  원복(`px-4`), Editor 상단 스트립도 제거(상단 바가 전폭 드래그 담당).
- ~~**OI-W2 (창 드래그 불가)**~~ → 해결. 위 상단 바가 전폭 드래그 영역 제공.
- ~~**OI-W3 (체크박스+IME 깨짐)**~~ → 해결. **두 가지 원인.**
  1. `buildCheckboxDecorations`가 커서 위치 무관하게 체크박스를 렌더(SPEC §8.4 #4 위반)
     → 조합 줄에 replace 위젯이 끼어 마지막 글자 소실. 수정: 표 위젯처럼 **커서 줄은 소스 노출**.
  2. **(핵심)** SPEC §8.4 #1을 "조합 중 `return`(동결)"로 구현한 게 화근. replace/block
     decoration을 동결하면 위 줄에 글자 삽입 시 아래 decoration의 치환 범위가 옛 위치에
     멈춰(stale) 엉뚱한 구간을 치환 → 줄 결합/테이블 밑 입력. 수정: 조합 중엔 재빌드 대신
     **`.map(changes)`로 위치만 갱신**(mark/checkbox/table 모두). 표는 입력 시 매핑, 커서
     이동 시에만 재빌드. (mark는 비파괴라 M3에서 무증상이었으나 replace/block은 치명적)
- ~~**OI-W4 (한글 task + Enter → 일반 줄)**~~ → 해결. IME 조합 중 Enter는 keymap 명령
  (`taskListEnter`)을 건너뛰어(조합 중 keymap 스킵) 기본 개행만 삽입됨. 수정:
  `taskListContinue`(`EditorState.transactionFilter`)로 **task 줄에서의 단순 `\n` 삽입을
  가로채 마커(`- [ ] `) 자동 부착**. 조합 여부와 무관하게 동작. 영문 Enter는 `taskListEnter`가
  처리하므로 그 결과(이미 마커 포함) 트랜잭션은 필터가 무시.
  - ⚠️ 1차("정확히 `\n` 삽입"만 감지)는 조합 commit이 replace 형태("다"→"다\n")로 동기화돼 실패.
  - ⚠️ 2차(`tr.selection`으로 새 줄 위치 판정)는 조합 중 커서가 stale이라 가끔 마커가 엉뚱한
    줄(예: 3줄 밑)에 삽입됨.
  - ⚠️ 3차(change 기하로 newDoc 좌표 계산)도 "가끔 3줄 밑"이 재발. 진짜 원인: `[tr, extra]`
    배열 반환 시 **extra의 `changes`는 기본적으로 startState(=tr 적용 전) 좌표로 해석**되는데
    `newLineStart`는 newDoc 좌표라 tr이 삽입한 길이만큼 어긋남.
  - 최종 해결: extra spec에 **`sequential: true`** 추가 → post-tr(newDoc) 좌표로 해석.
    + 삽입 위치는 change 기하(`fromB + inserted.line(1).length + 1`)로 결정적 계산(selection 비의존).
