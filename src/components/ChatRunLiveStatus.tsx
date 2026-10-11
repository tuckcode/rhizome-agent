import { useEffect, useRef, useState } from 'react'
import {
  chatRunSnapshotFromMessages,
  joinChatRunLines,
  nextChatRunAnnouncement,
  type ChatRunSnapshot,
} from '../lib/chatRunLiveStatus'

interface ChatRunLiveStatusProps {
  messages: Array<{
    id?: string
    actions?: Array<{ tool: string; toolId?: string; status: string }>
    response?: string
    localMarker?: string
    localMarkerTone?: 'warning'
  }>
  isActive: boolean
}

/**
 * One empty polite status region that receives throttled run updates.
 * Mounted empty so screen readers hear injected text (B1). Identical
 * consecutive lines are cleared, then restored on the next frame, so
 * VoiceOver re-reads "Response complete" on later turns.
 *
 * Frame ids live in refs. Streaming re-renders must not cancel a pending
 * announcement. A newer line while frames are scheduled is appended
 * ("notice. Response complete") so VoiceOver hears both. Unmount cancels.
 */
export function ChatRunLiveStatus({ messages, isActive }: ChatRunLiveStatusProps) {
  const previousRef = useRef<ChatRunSnapshot | null>(null)
  const pendingRef = useRef<string | null>(null)
  const clearFrameRef = useRef(0)
  const restoreFrameRef = useRef(0)
  const [announcement, setAnnouncement] = useState('')

  useEffect(() => {
    return () => {
      cancelAnimationFrame(clearFrameRef.current)
      cancelAnimationFrame(restoreFrameRef.current)
      pendingRef.current = null
    }
  }, [])

  useEffect(() => {
    const next = chatRunSnapshotFromMessages(messages, isActive)
    const text = nextChatRunAnnouncement(previousRef.current, next)
    previousRef.current = next
    if (!text) return

    if (pendingRef.current) {
      pendingRef.current = joinChatRunLines(pendingRef.current, text)
      return
    }

    pendingRef.current = text
    clearFrameRef.current = requestAnimationFrame(() => {
      setAnnouncement('')
      restoreFrameRef.current = requestAnimationFrame(() => {
        const pending = pendingRef.current
        pendingRef.current = null
        if (pending) setAnnouncement(pending)
      })
    })
  }, [isActive, messages])

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="chat-run-live-status"
      className="sr-only"
    >
      {announcement}
    </div>
  )
}
