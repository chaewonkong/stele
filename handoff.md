# Handoff — stele M3 에디터 코어

## 현재 상태

M0~M2 완료. 앱이 실행되고 기본 CRUD가 동작한다.
- Go 백엔드: sqlc 기반 SQLite CRUD, Wails 바인딩 완성
- 프론트엔드: 2-pane UI (사이드바 + textarea 에디터), 자동저장 동작
- 미완: 에디터가 단순 `<textarea>`. M3에서 CodeMirror 6으로 교체 필요

## M3 목표

`frontend/src/components/Editor.tsx`의 `<textarea>`를 CodeMirror 6으로 교체.
Bear형 마크다운 스타일링 + 한글 IME 가드 통과.

## 작업 범위

### 1. CM6 기본 세팅
`Editor.tsx`에서 `EditorView` 마운트. 현재 자동저장 패턴 유지:
- `bodyRef.current` 읽어 `UpdateNote(id, body)` 호출 (500ms 디바운스)
- `compositionend` 이후로 저장 트리거 정렬

### 2. Bear형 mark decoration (SPEC §8.1)
마커를 숨기지 않고 CSS로 흐리게/작게 처리. Lezer 구문 트리 기반 decoration.

지원 범위 (SPEC §8.5):
- H1–H6: 제목 크기/굵기
- `**bold**` / `*italic*` / `~~strike~~`
- `` `inline code` ``
- 코드블록 (펜스)
- 인용 `>`
- 순서/비순서 목록
- 링크
- 수평선

### 3. 한글 IME 가드 (SPEC §8.4) — 최우선
모든 decoration 계산 로직에 적용:

```typescript
// ViewPlugin 내부에서
update(update: ViewUpdate) {
  if (update.view.composing) return  // 조합 중 재계산 금지
  // decoration 계산...
}
```

키바인딩 (굵게 ⌘B 등 추가 시):
```typescript
keymap.of([{
  key: 'Mod-b',
  run: (view) => {
    if (view.composing) return false
    // ...
  }
}])
```

### 4. 자동저장 compositionend 정렬
```typescript
EditorView.domEventHandlers({
  compositionend: () => {
    // 조합 종료 시 즉시 저장 트리거
    scheduleSave(view.state.doc.toString())
    return false
  }
})
```

## 핵심 파일

| 파일 | 역할 |
|------|------|
| `frontend/src/components/Editor.tsx` | M3 교체 대상 |
| `frontend/src/App.tsx` | `onSaved` 콜백 유지 필요 |
| `docs/SPEC.md` §8.1~§8.5 | 스타일링 상세 스펙 |
| `frontend/package.json` | CM6 패키지 이미 설치됨 |

## 설치된 CM6 패키지

```
@codemirror/commands ^6.8.0
@codemirror/lang-markdown ^6.3.0
@codemirror/language ^6.11.0
@codemirror/state ^6.5.0
@codemirror/view ^6.36.0
codemirror ^6.0.1
```

## 주의사항

- `EditorView` 마운트 시 `useEffect` cleanup에서 `view.destroy()` 호출 필수
- note 전환 시 (`noteId` prop 변경): 기존 view에 `setState` 또는 destroy 후 재생성
- `EditorView.updateListener` 로 onChange 감지. `update.docChanged`만 체크
- mark decoration은 `RangeSetBuilder`로 구성, `Decoration.mark({class: '...'})` 사용
- Lezer 파서: `syntaxTree(state).cursor()` 로 AST traverse

## 오픈 이슈

- OI-2: 표 커서-인지 렌더 전환 시 깜빡임 최소화 (M4에서)
- 이미지 인라인 렌더: v1은 텍스트 링크 유지 (OI-1)
