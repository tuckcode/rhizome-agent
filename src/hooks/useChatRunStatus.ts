import { useEffect, useRef, useState } from 'react'
import { chatRunSnapshotFromMessages } from '../lib/chatRunLiveStatus'
import {
  chatRunActivityKey,
  chatRunStatus,
  type ChatRunFailure,
  type ChatRunStatus,
} from '../lib/chatRunStatus'

type RunMessages = Parameters<typeof chatRunSnapshotFromMessages>[0]
  & Parameters<typeof chatRunActivityKey>[0]

const TICK_MS = 1000

/** The one time source for the run clock. Stamps and ticks both read it. */
function readClock(): number {
  return Date.now()
}

/** A reading of the clock, taken on each tick. */
interface RunReading {
  now: number
  eventKey: string
  eventAt: number
  /** When each tool that still runs started, by tool id. */
  toolStarts: Record<string, number>
}

/**
 * The status of the current chat run, with a clock that counts the time
 * since the last event and the time each tool has run.
 *
 * A tool keeps its own start time, so streamed output or a parallel tool
 * that finishes does not reset its elapsed time. The clock ticks only
 * while a run is active, and reads again when the window comes back into
 * view, since a hidden window slows its timers.
 */
export function useChatRunStatus(
  messages: RunMessages,
  isActive: boolean,
  failure?: ChatRunFailure | null,
): ChatRunStatus {
  const snapshot = chatRunSnapshotFromMessages(messages, isActive)
  const activityKey = `${isActive ? 'on' : 'off'}|${chatRunActivityKey(messages)}`
  const pendingIds = snapshot.tools.filter((tool) => tool.status === 'pending').map((tool) => tool.id)
  const pendingKey = pendingIds.join('\u0000')

  // Stamped in effects, read only by the tick.
  const lastEvent = useRef({ key: activityKey, at: 0 })
  const toolStarts = useRef<Record<string, number>>({})
  const [reading, setReading] = useState<RunReading>({ now: 0, eventKey: activityKey, eventAt: 0, toolStarts: {} })

  useEffect(() => {
    lastEvent.current = { key: activityKey, at: readClock() }
  }, [activityKey])

  useEffect(() => {
    const at = readClock()
    const next: Record<string, number> = {}
    for (const id of pendingKey ? pendingKey.split('\u0000') : []) {
      next[id] = toolStarts.current[id] ?? at
    }
    toolStarts.current = next
  }, [pendingKey])

  useEffect(() => {
    if (!isActive) return
    const tick = () => setReading({
      now: readClock(),
      eventKey: lastEvent.current.key,
      eventAt: lastEvent.current.at,
      toolStarts: toolStarts.current,
    })
    const onVisibility = () => {
      if (document.visibilityState === 'visible') tick()
    }
    const timer = window.setInterval(tick, TICK_MS)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [isActive])

  const starts = pendingIds
    .map((id) => reading.toolStarts[id])
    .filter((at): at is number => typeof at === 'number')
  return chatRunStatus({
    snapshot,
    quietMs: reading.eventKey === activityKey ? reading.now - reading.eventAt : 0,
    toolElapsedMs: starts.length > 0 ? reading.now - Math.min(...starts) : 0,
    failure,
  })
}
