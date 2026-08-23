import { beforeEach, describe, expect, it, vi } from 'vitest'

const invoked = vi.hoisted(() => ({
  calls: [] as Array<{ cmd: string, args?: Record<string, unknown> }>,
  accepted: true as boolean,
  throws: false,
}))

vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: (cmd: string, args?: Record<string, unknown>) => {
    invoked.calls.push({ cmd, args })
    if (invoked.throws) return Promise.reject(new Error('daemon gone'))
    return Promise.resolve(invoked.accepted)
  },
}))

import { sendToRunningTurn } from './primeTurnMessaging'

beforeEach(() => {
  invoked.calls = []
  invoked.accepted = true
  invoked.throws = false
})

describe('sendToRunningTurn', () => {
  it('sends steer and follow-up to the commands Prime exposes for each', async () => {
    await sendToRunningTurn('steer', 'focus on error handling')
    await sendToRunningTurn('followUp', 'then summarise')

    expect(invoked.calls).toEqual([
      { cmd: 'steer_prime_session', args: { message: 'focus on error handling' } },
      { cmd: 'follow_up_prime_session', args: { message: 'then summarise' } },
    ])
  })

  it('trims the message before sending it', async () => {
    await sendToRunningTurn('followUp', '  padded  ')

    expect(invoked.calls[0].args).toEqual({ message: 'padded' })
  })

  it('never sends a blank message', async () => {
    expect(await sendToRunningTurn('steer', '   ')).toBe('not-running')
    expect(invoked.calls).toEqual([])
  })

  it('reports when no turn was running, rather than claiming success', async () => {
    invoked.accepted = false

    // `queue_message` answers false when nothing is streaming. The caller
    // needs that distinction to fall back to a normal send.
    expect(await sendToRunningTurn('followUp', 'anything')).toBe('not-running')
  })

  it('distinguishes a host failure from Prime declining the message', async () => {
    invoked.throws = true

    expect(await sendToRunningTurn('steer', 'anything')).toBe('failed')
  })
})
