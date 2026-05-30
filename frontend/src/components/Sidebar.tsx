import React from 'react'
import { main } from '../../wailsjs/go/models'

function formatDate(ms: number): string {
  const diff = Date.now() - ms
  const min = Math.floor(diff / 60_000)
  const hour = Math.floor(diff / 3_600_000)
  const day = Math.floor(diff / 86_400_000)
  if (min < 1) return '방금'
  if (min < 60) return `${min}분 전`
  if (hour < 24) return `${hour}시간 전`
  if (day < 7) return `${day}일 전`
  return new Date(ms).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })
}

interface Props {
  notes: main.NoteSummary[]
  activeNoteId: number | null
  showTrash: boolean
  onSelect: (id: number) => void
  onCreate: () => void
  onTogglePin: (id: number, pinned: boolean) => void
  onTrash: (id: number) => void
  onRestore: (id: number) => void
  onPurge: (id: number) => void
  onToggleTrash: () => void
}

export default function Sidebar({
  notes, activeNoteId, showTrash,
  onSelect, onCreate, onTogglePin, onTrash, onRestore, onPurge, onToggleTrash,
}: Props) {
  return (
    <aside className="w-64 shrink-0 bg-gray-50 border-r border-gray-200 flex flex-col h-full">
      <div className="flex items-center justify-between px-4 h-11 border-b border-gray-200 shrink-0 select-none">
        <span className="text-sm font-semibold text-gray-700">
          {showTrash ? '휴지통' : '메모'}
        </span>
        <div className="flex items-center gap-1">
          {!showTrash && (
            <HeaderBtn title="새 메모 (⌘N)" onClick={onCreate}>＋</HeaderBtn>
          )}
          <HeaderBtn
            title={showTrash ? '메모로 돌아가기' : '휴지통'}
            onClick={onToggleTrash}
            active={showTrash}
          >
            ⌫
          </HeaderBtn>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {notes.length === 0 && (
          <p className="text-xs text-gray-400 text-center mt-10 px-6 select-none">
            {showTrash ? '휴지통이 비어 있습니다' : '메모가 없습니다\n⌘N으로 새 메모를 만드세요'}
          </p>
        )}
        {notes.map(note => (
          <NoteItem
            key={note.id}
            note={note}
            isActive={note.id === activeNoteId}
            showTrash={showTrash}
            onSelect={onSelect}
            onTogglePin={onTogglePin}
            onTrash={onTrash}
            onRestore={onRestore}
            onPurge={onPurge}
          />
        ))}
      </div>
    </aside>
  )
}

function HeaderBtn({
  title, onClick, active, children,
}: { title: string; onClick: () => void; active?: boolean; children: React.ReactNode }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`w-7 h-7 flex items-center justify-center rounded text-base
        hover:bg-gray-200 transition-colors
        ${active ? 'text-blue-500' : 'text-gray-500'}`}
    >
      {children}
    </button>
  )
}

interface NoteItemProps {
  note: main.NoteSummary
  isActive: boolean
  showTrash: boolean
  onSelect: (id: number) => void
  onTogglePin: (id: number, pinned: boolean) => void
  onTrash: (id: number) => void
  onRestore: (id: number) => void
  onPurge: (id: number) => void
}

function NoteItem({ note, isActive, showTrash, onSelect, onTogglePin, onTrash, onRestore, onPurge }: NoteItemProps) {
  return (
    <div
      className={`group relative px-4 py-3 cursor-pointer border-b border-gray-100 ${
        isActive ? 'bg-blue-50' : 'hover:bg-gray-100'
      }`}
      onClick={() => onSelect(note.id)}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 truncate select-none">
            {note.pinned && <span className="mr-1 text-xs opacity-60">📌</span>}
            {note.title || 'Untitled'}
          </p>
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed select-none">
            {note.preview || '내용 없음'}
          </p>
        </div>
        <span className="text-xs text-gray-400 shrink-0 mt-0.5 select-none">
          {formatDate(note.updatedAt)}
        </span>
      </div>

      {/* 호버 액션 */}
      <div
        className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5 rounded px-1 py-0.5"
        onClick={e => e.stopPropagation()}
      >
        {!showTrash ? (
          <>
            <ActionBtn
              title={note.pinned ? '핀 해제' : '핀 고정'}
              onClick={() => onTogglePin(note.id, !note.pinned)}
            >
              📌
            </ActionBtn>
            <ActionBtn title="휴지통으로" onClick={() => onTrash(note.id)}>🗑</ActionBtn>
          </>
        ) : (
          <>
            <ActionBtn title="복원" onClick={() => onRestore(note.id)}>↩</ActionBtn>
            <ActionBtn title="영구 삭제" onClick={() => onPurge(note.id)}>✕</ActionBtn>
          </>
        )}
      </div>
    </div>
  )
}

function ActionBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-200 text-gray-600 text-xs"
    >
      {children}
    </button>
  )
}
