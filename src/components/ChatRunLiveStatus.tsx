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
 */
export function ChatRunLiveStatus({ messages, isActive }: ChatRunLiveStatusProps) {
  const previousRef = useRef<ChatRunSnapshot | null>(null)
  const [announcement, setAnnouncement] = useState('')

  useEffect(() => {
    const next = chatRunSnapshotFromMessages(messages, isActive)
    const text = nextChatRunAnnouncement(previousRef.current, next)
    previousRef.current = next
    if (!text) return

    let cancelled = false
    let restoreFrame = 0
    const clearFrame = requestAnimationFrame(() => {
      if (cancelled) return
      setAnnouncement('')
      restoreFrame = requestAnimationFrame(() => {
        if (cancelled) return
        setAnnouncement(text)
      })
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(clearFrame)
      cancelAnimationFrame(restoreFrame)
    }
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
