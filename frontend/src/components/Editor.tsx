import { useEffect, useRef } from 'react'
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, WidgetType, keymap } from '@codemirror/view'
import { EditorState, Prec, RangeSetBuilder } from '@codemirror/state'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { syntaxTree } from '@codemirror/language'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { GetNote, UpdateNote } from '../../wailsjs/go/main/App'
import { main } from '../../wailsjs/go/models'

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter(node) {
        switch (node.name) {
          case 'ATXHeading1':
            builder.add(node.from, node.to, Decoration.mark({ class: 'md-h1' }))
            break
          case 'ATXHeading2':
            builder.add(node.from, node.to, Decoration.mark({ class: 'md-h2' }))
            break
          case 'ATXHeading3':
            builder.add(node.from, node.to, Decoration.mark({ class: 'md-h3' }))
            break
          case 'ATXHeading4':
            builder.add(node.from, node.to, Decoration.mark({ class: 'md-h4' }))
            break
          case 'ATXHeading5':
          case 'ATXHeading6':
            builder.add(node.from, node.to, Decoration.mark({ class: 'md-h5' }))
            break
          case 'HeaderMark':
            builder.add(node.from, node.to, Decoration.mark({ class: 'md-mark' }))
            break
          case 'StrongEmphasis':
            builder.add(node.from, node.to, Decoration.mark({ class: 'md-bold' }))
            break
          case 'Emphasis':
            builder.add(node.from, node.to, Decoration.mark({ class: 'md-italic' }))
            break
          case 'Strikethrough':
            builder.add(node.from, node.to, Decoration.mark({ class: 'md-strike' }))
            break
          case 'EmphasisMark':
          case 'StrikethroughMark':
            builder.add(node.from, node.to, Decoration.mark({ class: 'md-mark' }))
            break
          case 'InlineCode':
            builder.add(node.from, node.to, Decoration.mark({ class: 'md-inline-code' }))
            break
          case 'CodeMark':
            builder.add(node.from, node.to, Decoration.mark({ class: 'md-code-mark' }))
            break
          case 'FencedCode':
            builder.add(node.from, node.to, Decoration.mark({ class: 'md-code-block' }))
            break
          case 'Blockquote':
            builder.add(node.from, node.to, Decoration.mark({ class: 'md-blockquote' }))
            break
          case 'QuoteMark':
            builder.add(node.from, node.to, Decoration.mark({ class: 'md-mark' }))
            break
          case 'ListMark':
            builder.add(node.from, node.to, Decoration.mark({ class: 'md-mark' }))
            break
          case 'Link':
            builder.add(node.from, node.to, Decoration.mark({ class: 'md-link' }))
            break
          case 'LinkMark':
            builder.add(node.from, node.to, Decoration.mark({ class: 'md-mark' }))
            break
          case 'URL':
            builder.add(node.from, node.to, Decoration.mark({ class: 'md-url' }))
            break
          case 'HorizontalRule':
            builder.add(node.from, node.to, Decoration.mark({ class: 'md-hr' }))
            break
        }
      },
    })
  }
  return builder.finish()
}

const markdownDecorations = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view)
    }

    update(update: ViewUpdate) {
      if (update.view.composing) return  // 한글 IME 가드: 조합 중 재계산 금지
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildDecorations(update.view)
      }
    }
  },
  { decorations: v => v.decorations }
)

// ─── Checkbox Widget ──────────────────────────────────────────────────────────

class CheckboxWidget extends WidgetType {
  constructor(
    readonly checked: boolean,
    readonly markerFrom: number,
    readonly markerTo: number,
  ) {
    super()
  }

  eq(other: CheckboxWidget) {
    return other.checked === this.checked && other.markerFrom === this.markerFrom
  }

  toDOM(view: EditorView): HTMLElement {
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.className = 'cm-task-checkbox'
    input.checked = this.checked
    input.onmousedown = (e) => {
      e.preventDefault()
      view.dispatch({
        changes: { from: this.markerFrom, to: this.markerTo, insert: this.checked ? '[ ]' : '[x]' },
      })
    }
    return input
  }

  ignoreEvent() { return true }
}

function buildCheckboxDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter(node) {
        if (node.name !== 'TaskMarker') return
        // Find ancestor ListItem to locate ListMark
        let ancestor = node.node.parent
        while (ancestor && ancestor.name !== 'ListItem') ancestor = ancestor.parent
        if (ancestor) {
          const listMark = ancestor.firstChild
          if (listMark && listMark.name === 'ListMark') {
            // Hide "- " (ListMark + space before TaskMarker)
            builder.add(listMark.from, node.from, Decoration.replace({}))
          }
        }
        const text = view.state.doc.sliceString(node.from, node.to)
        const checked = text === '[x]' || text === '[X]'
        builder.add(
          node.from,
          node.to,
          Decoration.replace({ widget: new CheckboxWidget(checked, node.from, node.to) }),
        )
      },
    })
  }
  return builder.finish()
}

const checkboxPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = buildCheckboxDecorations(view)
    }
    update(update: ViewUpdate) {
      if (update.view.composing) return
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildCheckboxDecorations(update.view)
      }
    }
  },
  { decorations: v => v.decorations },
)

// ─── Table Widget ─────────────────────────────────────────────────────────────

function parseTableDOM(source: string): HTMLElement {
  const wrap = document.createElement('div')
  wrap.className = 'cm-table-widget'
  const table = document.createElement('table')
  table.className = 'cm-md-table'
  const lines = source.trim().split('\n').map(l => l.trim()).filter(Boolean)
  let isFirst = true
  for (const line of lines) {
    const cells = line.split('|').slice(1, -1)
    if (cells.every(c => /^\s*:?-+:?\s*$/.test(c))) continue  // separator row
    const tr = document.createElement('tr')
    cells.forEach(cell => {
      const el = document.createElement(isFirst ? 'th' : 'td')
      el.textContent = cell.trim()
      tr.appendChild(el)
    })
    table.appendChild(tr)
    isFirst = false
  }
  wrap.appendChild(table)
  return wrap
}

class TableWidget extends WidgetType {
  constructor(readonly source: string, readonly tableFrom: number) {
    super()
  }

  eq(other: TableWidget) {
    return other.source === this.source
  }

  toDOM(view: EditorView): HTMLElement {
    const wrap = parseTableDOM(this.source)
    wrap.onmousedown = (e) => {
      e.preventDefault()
      view.dispatch({ selection: { anchor: this.tableFrom } })
      view.focus()
    }
    return wrap
  }

  ignoreEvent() { return true }
}

function buildTableDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const cursor = view.state.selection.main.head
  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter(node) {
        if (node.name !== 'Table') return
        if (cursor >= node.from && cursor <= node.to) return false
        const source = view.state.doc.sliceString(node.from, node.to)
        const startLine = view.state.doc.lineAt(node.from)
        const endLine = view.state.doc.lineAt(node.to)
        builder.add(
          startLine.from,
          endLine.to,
          Decoration.replace({ widget: new TableWidget(source, node.from), block: true }),
        )
        return false
      },
    })
  }
  return builder.finish()
}

const tablePlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = buildTableDecorations(view)
    }
    update(update: ViewUpdate) {
      if (update.view.composing) return
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = buildTableDecorations(update.view)
      }
    }
  },
  { decorations: v => v.decorations },
)

// ─── Task List Enter ──────────────────────────────────────────────────────────

function taskListEnter(view: EditorView): boolean {
  const state = view.state
  const range = state.selection.main
  if (!range.empty) return false

  const pos = range.from
  const line = state.doc.lineAt(pos)
  const m = /^(\s*[-+*] \[[ xX]\] )(.*)$/.exec(line.text)
  if (!m) return false

  const markerLen = m[1].length
  if (pos - line.from < markerLen) return false

  const hasContent = m[2].trim().length > 0

  if (!hasContent) {
    // 빈 task item: 마커 제거 후 일반 줄로
    view.dispatch({
      changes: { from: line.from, to: line.to, insert: '' },
      selection: { anchor: line.from },
      userEvent: 'input',
    })
    return true
  }

  // 내용 있는 task: 새 [ ] 항목 삽입
  const bullet = /^\s*[-+*]/.exec(line.text)![0]
  const newLine = '\n' + bullet + ' [ ] '
  view.dispatch({
    changes: { from: pos, insert: newLine },
    selection: { anchor: pos + newLine.length },
    scrollIntoView: true,
    userEvent: 'input',
  })
  return true
}

const editorTheme = EditorView.theme({
  '&': { height: '100%', display: 'flex', flexDirection: 'column' },
  '.cm-scroller': {
    flex: '1 1 0',
    overflow: 'auto',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: '15px',
    lineHeight: '1.7',
    padding: '2.5rem 3rem',
    color: '#111827',
  },
  '.cm-content': { padding: 0, caretColor: '#111827' },
  '.cm-line': { padding: 0 },
  '&.cm-focused': { outline: 'none' },
  '.cm-cursor': { borderLeftColor: '#374151' },
  '.cm-selectionBackground': { background: 'rgba(59,130,246,0.15) !important' },
  '&.cm-focused .cm-selectionBackground': { background: 'rgba(59,130,246,0.25) !important' },
})

interface Props {
  noteId: number | null
  onSaved: (summary: main.NoteSummary) => void
}

export default function Editor({ noteId, onSaved }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const activeIdRef = useRef<number | null>(null)
  const onSavedRef = useRef(onSaved)

  useEffect(() => {
    onSavedRef.current = onSaved
  }, [onSaved])

  useEffect(() => {
    clearTimeout(timerRef.current)
    activeIdRef.current = noteId

    viewRef.current?.destroy()
    viewRef.current = null

    if (noteId === null || !containerRef.current) return

    let cancelled = false

    GetNote(noteId).then(note => {
      if (cancelled || activeIdRef.current !== noteId) return

      const scheduleSave = (content: string, id: number) => {
        clearTimeout(timerRef.current)
        timerRef.current = setTimeout(async () => {
          const summary = await UpdateNote(id, content)
          if (activeIdRef.current === id) onSavedRef.current(summary)
        }, 500)
      }

      const view = new EditorView({
        state: EditorState.create({
          doc: note.body,
          extensions: [
            history(),
            keymap.of([...historyKeymap, ...defaultKeymap]),
            Prec.highest(keymap.of([{ key: 'Enter', run: taskListEnter }])),
            markdown({ base: markdownLanguage }),
            EditorView.lineWrapping,
            markdownDecorations,
            checkboxPlugin,
            tablePlugin,
            editorTheme,
            EditorView.updateListener.of(update => {
              if (!update.docChanged) return
              const id = activeIdRef.current
              if (id === null) return
              scheduleSave(update.state.doc.toString(), id)
            }),
            EditorView.domEventHandlers({
              compositionend: (_e, view) => {
                const id = activeIdRef.current
                if (id === null) return false
                scheduleSave(view.state.doc.toString(), id)
                return false
              },
            }),
          ],
        }),
        parent: containerRef.current!,
      })

      viewRef.current = view
      view.focus()
    })

    return () => {
      cancelled = true
      clearTimeout(timerRef.current)
      viewRef.current?.destroy()
      viewRef.current = null
    }
  }, [noteId])

  if (noteId === null) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-gray-400 select-none">
          메모를 선택하거나 ⌘N으로 새 메모를 만드세요
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      <div ref={containerRef} className="flex-1 min-h-0" />
    </div>
  )
}
