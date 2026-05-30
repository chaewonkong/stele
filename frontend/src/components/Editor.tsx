import { useEffect, useRef } from 'react'
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, keymap } from '@codemirror/view'
import { EditorState, RangeSetBuilder } from '@codemirror/state'
import { markdown } from '@codemirror/lang-markdown'
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
            markdown(),
            EditorView.lineWrapping,
            markdownDecorations,
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
