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
 * Mounted empty so screen readers hear injected text (B1).
 */
export function ChatRunLiveStatus({ messages, isActive }: ChatRunLiveStatusProps) {
  const previousRef = useRef<ChatRunSnapshot | null>(null)
  const [announcement, setAnnouncement] = useState('')

  useEffect(() => {
    const next = chatRunSnapshotFromMessages(messages, isActive)
    const text = nextChatRunAnnouncement(previousRef.current, next)
    previousRef.current = next
    if (text) setAnnouncement(text)
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
