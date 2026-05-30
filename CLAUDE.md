# stele

macOS용 로컬 마크다운 메모 앱. 상세 스펙은 `docs/SPEC.md` 참고.

## 기술 스택

- **런타임**: Wails v2 (WKWebView, macOS 네이티브 IME)
- **백엔드**: Go + `modernc.org/sqlite` (CGO 불필요)
- **프론트엔드**: React 18 + TypeScript + Vite 6
- **에디터**: CodeMirror 6 + `@codemirror/lang-markdown`
- **스타일**: Tailwind CSS v4
- **패키지 매니저**: pnpm

## 디렉토리 구조

```
stele/
├── main.go              # Wails 앱 진입점
├── app.go               # Wails 바인딩 메서드 (Go ↔ JS)
├── wails.json           # Wails 빌드 설정
├── go.mod / go.sum
├── docs/
│   └── SPEC.md          # 제품 스펙
└── frontend/
    ├── src/
    │   ├── main.tsx
    │   ├── App.tsx
    │   └── style.css    # Tailwind 진입점
    ├── wailsjs/         # wails generate로 자동 생성되는 Go 바인딩 타입
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

# DMG 패키징 (build 후)
wails build -platform darwin/arm64
```

## 데이터 저장

- DB 위치: `~/Library/Application Support/stele/notes.db`
- 사용자에게 노출하지 않음. 앱이 자동 생성·관리.

## 마일스톤

- [x] **M0** — 스캐폴드: Wails v2 + react-ts, 의존성 설정
- [ ] **M1** — 데이터 계층: SQLite 스키마 + Go API (CRUD/export)
- [ ] **M2** — 기본 UI: 2-pane 레이아웃, 사이드바, 자동저장
- [ ] **M3** — 에디터 코어: CM6 Bear형 스타일링, **한글 IME 가드**
- [ ] **M4** — 블록 위젯: 체크박스, 표 (커서-인지 렌더)
- [ ] **M5** — export·마감: 성능 점검, DMG 배포

## 핵심 제약 (위반 시 버그)

### 한글 IME 가드 (SPEC §8.4)
1. `view.composing === true` 동안 decoration 재계산/치환 금지
2. 커스텀 키바인딩 핸들러 진입 시 `if (e.isComposing) return;`
3. 자동저장 디바운스는 문서를 읽기만 함 — 에디터 상태 변경 금지
4. 표·체크박스 위젯은 커서/조합 없는 위치에서만 활성

### 에디터 렌더 방식 (SPEC §8.1)
- Bear형: 마커 유지 + mark decoration (스타일만, 텍스트 비파괴)
- Typora/Obsidian식 완전 WYSIWYG은 v1 비목표
