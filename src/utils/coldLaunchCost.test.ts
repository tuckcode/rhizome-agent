import { describe, expect, it } from 'vitest'
import {
  COLD_LAUNCH_SESSION_ROWS,
  COLD_LAUNCH_TRANSCRIPT_BYTES,
  COLD_LAUNCH_TRANSCRIPT_ITEMS,
  buildColdLaunchSessions,
  buildColdLaunchTranscript,
  median,
} from './coldLaunchCost'

describe('cold launch cost fixtures', () => {
  it('builds a transcript the size of the newest session log', () => {
    const items = buildColdLaunchTranscript()
    expect(items).toHaveLength(COLD_LAUNCH_TRANSCRIPT_ITEMS)
    const bytes = JSON.stringify(items).length
    expect(bytes).toBeGreaterThanOrEqual(COLD_LAUNCH_TRANSCRIPT_BYTES)
    expect(bytes).toBeLessThan(COLD_LAUNCH_TRANSCRIPT_BYTES + 4096)
  })

  it('builds one live row per listed session', () => {
    const sessions = buildColdLaunchSessions()
    expect(sessions).toHaveLength(COLD_LAUNCH_SESSION_ROWS)
    expect(sessions.every((session) => session.hasConversation && !session.archived && !session.scratch)).toBe(true)
  })

  it('returns the middle sample', () => {
    expect(median([4, 1, 9])).toBe(4)
    expect(median([1, 2, 3, 4])).toBe(2.5)
    expect(median([])).toBe(0)
  })
})
