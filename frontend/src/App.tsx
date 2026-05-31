import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { CreateNote, ExportNote, ListNotes, PurgeNote, RestoreNote, TogglePin, TrashNote } from '../wailsjs/go/main/App'
import { main } from '../wailsjs/go/models'
import Editor from './components/Editor'
import Sidebar from './components/Sidebar'

export default function App() {
  const [notes, setNotes] = useState<main.NoteSummary[]>([])
  const [activeNoteId, setActiveNoteId] = useState<number | null>(null)
  const [showTrash, setShowTrash] = useState(false)

  const refreshNotes = useCallback(async () => {
    const list = await ListNotes(showTrash)
    setNotes(list ?? [])
  }, [showTrash])

  useEffect(() => { refreshNotes() }, [refreshNotes])

  const handleCreate = useCallback(async () => {
    const note = await CreateNote()
    setActiveNoteId(note.id)
    await refreshNotes()
  }, [refreshNotes])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.isComposing) return
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault()
        handleCreate()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleCreate])

  const handleSaved = useCallback((summary: main.NoteSummary) => {
    setNotes(prev => prev.map(n => n.id === summary.id ? summary : n))
  }, [])

  const handleTogglePin = useCallback(async (id: number, pinned: boolean) => {
    await TogglePin(id, pinned)
    await refreshNotes()
  }, [refreshNotes])

  const handleTrash = useCallback(async (id: number) => {
    await TrashNote(id)
    if (activeNoteId === id) setActiveNoteId(null)
    await refreshNotes()
  }, [activeNoteId, refreshNotes])

  const handleRestore = useCallback(async (id: number) => {
    await RestoreNote(id)
    setActiveNoteId(null)
    await refreshNotes()
  }, [refreshNotes])

  const handlePurge = useCallback(async (id: number) => {
    if (!window.confirm('이 노트를 영구 삭제할까요? 되돌릴 수 없습니다.')) return
    await PurgeNote(id)
    if (activeNoteId === id) setActiveNoteId(null)
    await refreshNotes()
  }, [activeNoteId, refreshNotes])

  const handleToggleTrash = useCallback(() => {
    setShowTrash(v => !v)
    setActiveNoteId(null)
  }, [])

  const handleExport = useCallback(async (id: number) => {
    try {
      await ExportNote(id)
    } catch (e) {
      console.error('ExportNote failed:', e)
    }
  }, [])

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-white">
      {/* 신호등 전용 드래그 타이틀바 (OI-W1/W2): 사이드바와 동일한 회색으로 통일 */}
      <div
        className="h-9 shrink-0 bg-gray-50"
        style={{ '--wails-draggable': 'drag' } as CSSProperties}
      />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <Sidebar
          notes={notes}
          activeNoteId={activeNoteId}
          showTrash={showTrash}
          onSelect={setActiveNoteId}
          onCreate={handleCreate}
          onTogglePin={handleTogglePin}
          onTrash={handleTrash}
          onRestore={handleRestore}
          onPurge={handlePurge}
          onToggleTrash={handleToggleTrash}
          onExport={handleExport}
        />
        <Editor noteId={activeNoteId} onSaved={handleSaved} />
      </div>
    </div>
  )
}
