# stele

A minimal, local-first Markdown note app for macOS. No vault setup, no cloud sync — just write.

## Stack

- **Runtime**: Wails v2 (WKWebView)
- **Backend**: Go + SQLite
- **Frontend**: React + TypeScript + Vite
- **Editor**: CodeMirror 6
- **Styles**: Tailwind CSS v4

## Development

```bash
wails dev        # dev server with hot reload
wails build      # production build (.app)
```

## Requirements

- Go 1.21+
- Node.js 18+
- pnpm
- Wails v2 (`brew install wails`)
