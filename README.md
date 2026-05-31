# stele

macOS용 로컬 마크다운 메모 앱. 마크다운 네이티브, 한글 입력(IME)이 깨지지 않고, 설정 없이 즉시 사용 가능한 미니멀 메모 앱.

## 설치 (macOS, Apple Silicon)

1. [Releases](../../releases)에서 최신 `stele.dmg` 다운로드
2. DMG를 열고 **stele.app**을 **Applications** 폴더로 드래그
3. 첫 실행 — 앱이 **미서명**이라 macOS가 차단함:
   - **Sequoia(15) 이상**: 한 번 실행 시도 → **시스템 설정 > 개인정보 보호 및 보안** 맨 아래 "stele을(를) 열 수 없습니다" 항목의 **"그래도 열기"** 클릭 → 관리자 인증
   - 위 항목이 안 보이면 터미널에서 quarantine 속성 제거:
     ```bash
     xattr -dr com.apple.quarantine /Applications/stele.app
     ```
4. 이후 실행에는 경고가 없음.

> 데이터는 `~/Library/Application Support/stele/notes.db`에 자동 저장됩니다 (사용자 조작 불필요).

## 사용

- `⌘N` — 새 메모
- 사이드바 노트 hover → 핀 / 내보내기(`.md`) / 휴지통
- 마크다운 라이브 스타일링(Bear형), 체크박스·표 위젯 지원

## 기술 스택

Wails v2 (WKWebView) · Go + SQLite(modernc, CGO-free) · React + TypeScript + Vite · CodeMirror 6 · Tailwind CSS v4

## 소스에서 빌드

요구: Go 1.25+, Node 20+, pnpm, [Wails v2](https://wails.io)

```bash
# 개발 (핫 리로드)
wails dev

# 프로덕션 빌드 → build/bin/stele.app
wails build -platform darwin/arm64

# DMG 패키징
STAGE=$(mktemp -d)
cp -R build/bin/stele.app "$STAGE/"
ln -s /Applications "$STAGE/Applications"
hdiutil create -volname "stele" -srcfolder "$STAGE" -ov -format UDZO build/bin/stele.dmg
rm -rf "$STAGE"
```

앱 아이콘은 `build/appicon.svg`(소스) → `build/appicon.png`(1024²)로 생성. 변경 시 `rsvg-convert -w 1024 -h 1024 build/appicon.svg -o build/appicon.png` 후 재빌드.

상세 스펙·개발 가이드: [`CLAUDE.md`](CLAUDE.md), [`docs/SPEC.md`](docs/SPEC.md)
