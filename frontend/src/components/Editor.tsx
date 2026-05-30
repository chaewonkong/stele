import { useEffect, useRef, useState } from 'react'
import { GetNote, UpdateNote } from '../../wailsjs/go/main/App'
import { main } from '../../wailsjs/go/models'

interface Props {
  noteId: number | null
  onSaved: (summary: main.NoteSummary) => void
}

export default function Editor({ noteId, onSaved }: Props) {
  const [body, setBody] = useState('')
  const bodyRef = useRef('')
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const activeIdRef = useRef<number | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    clearTimeout(timerRef.current)
    activeIdRef.current = noteId
    setBody('')
    bodyRef.current = ''

    if (noteId === null) return

    GetNote(noteId).then(note => {
      if (activeIdRef.current !== noteId) return
      setBody(note.body)
      bodyRef.current = note.body
      textareaRef.current?.focus()
    })
  }, [noteId])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setBody(value)
    bodyRef.current = value

    const id = activeIdRef.current
    if (id === null) return

    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      const summary = await UpdateNote(id, bodyRef.current)
      if (activeIdRef.current === id) onSaved(summary)
    }, 500)
  }

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
    <div className="flex-1 flex flex-col h-full min-w-0">
      <textarea
        ref={textareaRef}
        className="flex-1 w-full resize-none border-none outline-none px-12 py-10 text-[15px] leading-relaxed text-gray-900 bg-white placeholder-gray-300 font-mono"
        value={body}
        onChange={handleChange}
        placeholder="내용을 입력하세요..."
        spellCheck={false}
      />
    </div>
  )
}
