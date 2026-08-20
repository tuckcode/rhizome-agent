import { describe, expect, it } from 'vitest'
import {
  isHeartbeatWork,
  scheduledWorkNextRun,
  withHeartbeatFlag,
  type PrimeScheduledWork,
} from './primeScheduledWork'

/** Shape observed live from prime-agent 0.7.4's `cron_list`. */
function work(overrides: Partial<PrimeScheduledWork> = {}): PrimeScheduledWork {
  return {
    id: '8a44b0c4-7835-4e00-814a-45cc362c9877',
    label: 'Check open work',
    interval: 'every 30 minutes',
    status: 'active',
    source: 'heartbeat',
    nextRunAt: '2026-08-20T04:24:19.124Z',
    ...overrides,
  }
}

describe('isHeartbeatWork', () => {
  it('treats heartbeat and rlm_heartbeat as pausable', () => {
    expect(isHeartbeatWork(work({ source: 'heartbeat' }))).toBe(true)
    expect(isHeartbeatWork(work({ source: 'rlm_heartbeat' }))).toBe(true)
  })

  it('treats a plain cron job as not pausable', () => {
    // The daemon has heartbeat_manage but no cron_pause. Offering a pause the
    // backend cannot honour is worse than omitting it.
    expect(isHeartbeatWork(work({ source: 'cron' }))).toBe(false)
  })

  it('fails safe when the source is missing', () => {
    expect(isHeartbeatWork(work({ source: undefined }))).toBe(false)
    expect(isHeartbeatWork(work({ source: '' }))).toBe(false)
  })
})

describe('withHeartbeatFlag', () => {
  it('tags each entry with what the UI may offer', () => {
    const tagged = withHeartbeatFlag([work({ source: 'heartbeat' }), work({ source: 'cron' })])
    expect(tagged.map((item) => item.isHeartbeat)).toEqual([true, false])
  })

  it('leaves the original entries untouched', () => {
    const original = work({ source: 'cron' })
    withHeartbeatFlag([original])
    expect(original).not.toHaveProperty('isHeartbeat')
  })
})

describe('scheduledWorkNextRun', () => {
  const now = Date.parse('2026-08-20T04:00:00.000Z')

  it('answers how soon, not at what timestamp', () => {
    expect(scheduledWorkNextRun(work({ nextRunAt: '2026-08-20T04:24:00.000Z' }), now)).toBe('in 24m')
    expect(scheduledWorkNextRun(work({ nextRunAt: '2026-08-20T09:00:00.000Z' }), now)).toBe('in 5h')
    expect(scheduledWorkNextRun(work({ nextRunAt: '2026-08-23T04:00:00.000Z' }), now)).toBe('in 3d')
  })

  it('says due rather than counting seconds', () => {
    // Daemon and UI clocks differ; a few seconds either way is meaningless.
    expect(scheduledWorkNextRun(work({ nextRunAt: '2026-08-20T04:00:30.000Z' }), now)).toBe('due')
    expect(scheduledWorkNextRun(work({ nextRunAt: '2026-08-20T03:58:00.000Z' }), now)).toBe('due')
  })

  it('omits the time rather than guessing when it is missing or unparseable', () => {
    expect(scheduledWorkNextRun(work({ nextRunAt: undefined }), now)).toBeNull()
    expect(scheduledWorkNextRun(work({ nextRunAt: '   ' }), now)).toBeNull()
    expect(scheduledWorkNextRun(work({ nextRunAt: 'soon-ish' }), now)).toBeNull()
  })
})
