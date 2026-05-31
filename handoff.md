# Handoff — stele M5 (export·마감)

## 현재 상태

M0~M5 완료 (콜드 스타트 수치 측정만 보류). v1 기능 마감 단계.

- Go 백엔드: sqlc 기반 SQLite CRUD, Wails 바인딩 완성
- 프론트엔드: 2-pane UI, CM6 에디터 (Bear형 decoration + 한글 IME 가드 + 자동저장)
- 블록 위젯: 체크박스 토글, 표 커서-인지 렌더 (IME 안전)
- macOS 윈도우 크롬: 신호등 전용 상단 드래그 바
- **단일 노트 export UI**: 완료 (이번 세션)

---

## M5 이번 세션 완료

### 단일 노트 export UI (완료)

- 사이드바 노트 항목 **hover 시 pill 툴바**의 `⤓` 버튼 → `ExportNote(id)` 호출 → 네이티브
  저장 다이얼로그(`SaveFileDialog`)로 `.md` 저장.
- 배선: `App.tsx` `handleExport` → `ExportNote` (try/catch + `console.error`),
  `Sidebar` `onExport` prop → `NoteItem`의 `ActionBtn`.

### 전체 export 비제공 (결정)

- SPEC §6.3의 "전체 export"는 **v1에서 UI 미제공**으로 결정.
- 사이드바 헤더의 전체-내보내기 버튼 및 `onExportAll`/`handleExportAll` 배선 **제거**.
- ⚠️ Go 백엔드 `ExportAll` / `store.ListActiveNotesForExport` / 관련 sqlc 쿼리는
  **dead code로 잔존**(의도적 보존). 추후 필요 시 재배선만 하면 됨.

### hover 액션 툴바 가독성 개선 (완료)

- 문제: 기존 hover 버튼이 노트 텍스트 위에 반투명하게 겹쳐 가독성 저하.
- 해결: **불투명 흰색 pill 툴바**(`bg-white shadow-md ring-1 ring-black/5 rounded-md`)로
  텍스트를 깔끔히 덮음. 회색/파란(active) 행 양쪽에서 일관.
- 위치: 수직 중앙 → **title 행에 맞춰 상단 정렬**(`top-2.5`). 버튼 `w-6→w-5`로 축소.
- hover 시 우측 상단 **날짜는 `invisible`** 처리 → pill과 겹침 방지.

### 변경 파일

| 파일 | 변경 |
|------|------|
| `frontend/src/App.tsx` | `ExportNote` import, `handleExport` 핸들러, `onExport` 전달 (전체 export 배선 제거) |
| `frontend/src/components/Sidebar.tsx` | `onExport` prop, NoteItem `⤓` 버튼, hover pill 툴바, 헤더 전체-export 버튼 제거 |

검증: `tsc --noEmit` exit 0, `vite build` 성공, `go test ./...` ok.

---

## M5 빌드·배포 (완료)

### DMG 패키징 (완료)

- 빌드: `wails build -platform darwin/arm64` → `build/bin/stele.app` (번들 12M, arm64,
  Wails self-signed). `build/bin`은 `.gitignore` 대상이라 산출물은 커밋 안 됨.
- DMG: `create-dmg` 미설치라 **`hdiutil`로 패키징** (드래그 설치형, `/Applications` 심볼릭 링크 포함):
  ```bash
  STAGE=$(mktemp -d)
  cp -R build/bin/stele.app "$STAGE/"
  ln -s /Applications "$STAGE/Applications"
  hdiutil create -volname "stele" -srcfolder "$STAGE" -ov -format UDZO build/bin/stele.dmg
  rm -rf "$STAGE"
  ```
  결과: `build/bin/stele.dmg` (~5.9M 압축, 체크섬 VALID).
- v1은 **미서명 로컬 배포**. Sequoia(15+) 설치 절차: 첫 실행 차단 → 시스템 설정 > 개인정보 보호 및
  보안 하단 > "그래도 열기". 코드 서명/notarization은 v1 비목표(문서로만).

### 콜드 스타트 (측정 보류)

- SPEC §10 목표 < 1.0s (허용 < 1.5s, M2 MacBook Air 기준). 번들 12M로 번들 목표는 충족.
- ⚠️ `wails dev`는 Vite 개발 서버 때문에 느림 → **측정은 반드시 `wails build` 후 `.app` 실행 기준**.
- 정확한 수치는 사용자 M2 환경에서 직접 측정 필요 → 현재 보류. 필요 시 진행.
- 참고: vite 빌드가 단일 chunk ~650kB(gzip ~221kB) 경고. 로컬 앱이라 치명적이진 않으나, 추가
  최적화 시 code-split 고려.

---

## 핵심 제약 (위반 시 버그) — IME 가드 요약 (SPEC §8.4)

1. 조합 중 decoration **재계산 금지 + 동결도 금지** — replace/block은 `decorations.map(changes)`로
   위치만 갱신, 재계산은 조합 종료 후.
2. 커스텀 키바인딩: `if (e.isComposing) return;` 즉시 패스.
3. 자동저장: `bodyRef`/문서 문자열 **읽기만**, 에디터 상태 변경 금지.
4. 표·체크박스 위젯은 커서/조합 없는 위치에서만 활성 (커서 줄은 소스 노출).
5. IME 중에도 동작할 키 동작은 keymap이 아니라 `EditorState.transactionFilter`로
   (`[tr, extra]` 반환 시 extra 좌표가 post-tr이면 `sequential: true` 필수).

에디터 렌더: Bear형(마커 유지 + mark decoration, 비파괴). 완전 WYSIWYG은 v1 비목표.

---

## 개발 환경 메모

- 이번 세션에 글로벌 RTK Bash 출력 필터 훅을 **비활성화**함
  (`~/.claude/settings.json`의 `PreToolUse > Bash > rtk hook claude` 제거,
  백업 `~/.claude/settings.json.pre-rtk-disable.bak`). 복구하려면 백업에서 해당 훅 복원.

---

## 오픈 이슈

- **OI-2**: 표 렌더 전환 시 깜빡임 최소화 (여유 시 검토).
- **OI-1**: 이미지 인라인 렌더 — v1은 텍스트 링크 유지(v2 검토).
