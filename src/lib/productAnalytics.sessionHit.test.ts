import { beforeEach, describe, expect, it, vi } from 'vitest'

const { trackEvent } = vi.hoisted(() => ({
  trackEvent: vi.fn(),
}))

vi.mock('./telemetry', () => ({
  trackEvent: (...args: unknown[]) => trackEvent(...args),
}))

import { trackSessionTranscriptHitOpened } from './productAnalytics'

describe('session transcript hit analytics', () => {
  beforeEach(() => {
    trackEvent.mockReset()
  })

  it('records the role and not the query or path', () => {
    trackSessionTranscriptHitOpened('assistant')

    expect(trackEvent).toHaveBeenCalledWith('session_transcript_hit_opened', { role: 'assistant' })
    const properties = trackEvent.mock.calls[0]?.[1]
    expect(JSON.stringify(properties)).not.toContain('socket')
    expect(JSON.stringify(properties)).not.toContain('/sessions')
  })
})
