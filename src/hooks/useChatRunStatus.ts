import { useEffect, useRef, useState } from 'react'
import { chatRunSnapshotFromMessages } from '../lib/chatRunLiveStatus'
import { chatRunActivityKey, chatRunStatus, type ChatRunStatus } from '../lib/chatRunStatus'

type RunMessages = Parameters<typeof chatRunSnapshotFromMessages>[0]
  & Parameters<typeof chatRunActivityKey>[0]

const TICK_MS = 1000

/**
 * The status of the current chat run, with a clock that counts the time
 * since the last event. The clock runs only while a run is active.
 */
export function useChatRunStatus(
  messages: RunMessages,
  isActive: boolean,
  failureReason?: string | null,
): ChatRunStatus {
  const activityKey = `${isActive ? 'on' : 'off'}|${chatRunActivityKey(messages)}`
  // The effect below sets the time on mount, before the first tick.
  const lastEvent = useRef({ key: activityKey, at: 0 })
  // The quiet time belongs to one activity key. A new key reads as zero
  // until the next tick.
  const [quiet, setQuiet] = useState({ key: activityKey, ms: 0 })

  useEffect(() => {
    lastEvent.current = { key: activityKey, at: Date.now() }
  }, [activityKey])

  useEffect(() => {
    if (!isActive) return
    const timer = window.setInterval(() => {
      const { key, at } = lastEvent.current
      setQuiet({ key, ms: Date.now() - at })
    }, TICK_MS)
    return () => window.clearInterval(timer)
  }, [isActive])

  return chatRunStatus({
    snapshot: chatRunSnapshotFromMessages(messages, isActive),
    quietMs: quiet.key === activityKey ? quiet.ms : 0,
    failureReason,
  })
}
