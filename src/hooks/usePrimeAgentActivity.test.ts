import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const host = vi.hoisted(() => ({ readings: [] as unknown[], index: 0, fail: false }))
vi.mock('../lib/callHost', () => ({
  callHost: () => {
    if (host.fail) return Promise.reject(new Error('host down'))
    const next = host.readings[Math.min(host.index, host.readings.length - 1)]
    host.index += 1
    return Promise.resolve(next)
  },
}))

import { usePrimeAgentActivity } from './usePrimeAgentActivity'

const POLL = 1_000
const working = { goal: { active: true, status: 'active' }, heartbeats: [], schedules: [] }
const done = { goal: { active: false, status: 'completed' }, heartbeats: [], schedules: [] }

/**
 * This poll used to live inside `AgentActivityBand`, which renders only on the
 * Chat destination — so a goal finishing while the user was reading notes was
 * never noticed. These assert the behaviour that move was for.
 */
describe('watching the harness', () => {
  let celebrated: string[]

  beforeEach(() => {
    celebrated = []
    host.readings = []
    host.index = 0
    host.fail = false
    vi.useFakeTimers()
  })

  function watch() {
    return renderHook(() =>
      usePrimeAgentActivity({
        enabled: true,
        pollMs: POLL,
        celebrate: (reason) => {
          celebrated.push(reason)
          return true
        },
      }),
    )
  }

  async function tick(times = 1) {
    for (let i = 0; i < times; i += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(POLL)
      })
    }
  }

  it('celebrates a goal that finishes between two readings', async () => {
    host.readings = [working, done]

    watch()
    await tick(2)

    expect(celebrated).toEqual(['goal-completed'])
  })

  it('celebrates once, not on every poll while it stays complete', async () => {
    host.readings = [working, done, done, done]

    watch()
    await tick(4)

    expect(celebrated).toEqual(['goal-completed'])
  })

  it('says nothing about a goal the user cleared', async () => {
    host.readings = [working, { heartbeats: [], schedules: [] }]

    watch()
    await tick(2)

    expect(celebrated).toEqual([])
  })

  it('does not poll at all when disabled', async () => {
    host.readings = [working]

    renderHook(() => usePrimeAgentActivity({ enabled: false, pollMs: POLL }))
    await tick(2)

    expect(host.index).toBe(0)
  })

  /**
   * A dropped poll is not the goal changing. Forgetting the last reading would
   * make the next successful one look like a first sighting, and a completion
   * across the gap would be swallowed.
   */
  it('remembers the last goal across a failed read', async () => {
    host.readings = [working, done]

    const { result } = watch()
    await tick(1)

    host.fail = true
    await act(async () => {
      await result.current.refresh()
    })
    host.fail = false

    await tick(1)

    expect(celebrated).toEqual(['goal-completed'])
  })
})
