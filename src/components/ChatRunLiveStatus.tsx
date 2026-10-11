import { useEffect, useRef, useState } from 'react'
import {
  chatRunSnapshotFromMessages,
  nextChatRunAnnouncement,
  type ChatRunSnapshot,
} from '../lib/chatRunLiveStatus'

interface ChatRunLiveStatusProps {
  messages: Array<{
    actions?: Array<{ tool: string; toolId?: string; status: string }>
    response?: string
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
 * announcement; only a newer line, or unmount, may.
 */
export function ChatRunLiveStatus({ messages, isActive }: ChatRunLiveStatusProps) {
  const previousRef = useRef<ChatRunSnapshot | null>(null)
  const clearFrameRef = useRef(0)
  const restoreFrameRef = useRef(0)
  const [announcement, setAnnouncement] = useState('')

  useEffect(() => {
    return () => {
      cancelAnimationFrame(clearFrameRef.current)
      cancelAnimationFrame(restoreFrameRef.current)
    }
  }, [])

  useEffect(() => {
    const next = chatRunSnapshotFromMessages(messages, isActive)
    const text = nextChatRunAnnouncement(previousRef.current, next)
    previousRef.current = next
    if (!text) return

    cancelAnimationFrame(clearFrameRef.current)
    cancelAnimationFrame(restoreFrameRef.current)
    clearFrameRef.current = requestAnimationFrame(() => {
      setAnnouncement('')
      restoreFrameRef.current = requestAnimationFrame(() => {
        setAnnouncement(text)
      })
    })
  }, [isActive, messages])

  return (
    <div
      role="status"
      data-testid="chat-run-live-status"
      className="sr-only"
    >
      {announcement}
    </div>
  )
}
