import { describe, expect, it, vi } from 'vitest'
import {
  buildSessionAutoDistillText,
  isSessionAutoDistillEnabled,
  queueSessionAutoDistill,
  turnAlreadyCalledDistill,
} from './sessionAutoDistill'

describe('sessionAutoDistill', () => {
  it('defaults ON when unset', () => {
    expect(isSessionAutoDistillEnabled(null)).toBe(true)
    expect(isSessionAutoDistillEnabled(undefined)).toBe(true)
    expect(isSessionAutoDistillEnabled(false)).toBe(false)
    expect(isSessionAutoDistillEnabled(true)).toBe(true)
  })

  it('skips short or error assistant replies', () => {
    expect(buildSessionAutoDistillText('hi', 'ok')).toBeNull()
    expect(buildSessionAutoDistillText('hi', 'Error: boom')).toBeNull()
    expect(
      buildSessionAutoDistillText(
        'hi',
        'Claude finished without returning a reply.',
      ),
    ).toBeNull()
  })

  it('skips OAuth and RPC host failure text so they never become wiki concepts', () => {
    const oauth =
      'Failed to authenticate: OAuth session expired and could not be refreshed'
    expect(buildSessionAutoDistillText('hi', oauth)).toBeNull()
    expect(
      buildSessionAutoDistillText(
        'hi',
        'Error: invalid args request for command stream_prime_session: missing field vaultPath',
      ),
    ).toBeNull()
  })

  it('builds a turn payload when the assistant reply is substantial', () => {
    const assistant = 'A'.repeat(100)
    const text = buildSessionAutoDistillText('Remember: deploy Fridays only', assistant)
    expect(text).toContain('## User')
    expect(text).toContain('Remember: deploy Fridays only')
    expect(text).toContain('## Assistant')
    expect(text).toContain(assistant)
  })

  it('detects an in-turn distill tool call', () => {
    expect(turnAlreadyCalledDistill(['Bash', 'rhizome_distill'])).toBe(true)
    expect(turnAlreadyCalledDistill(['Read', 'Edit'])).toBe(false)
  })

  it('queues a session_auto distill job when eligible', async () => {
    const startJob = vi.fn().mockResolvedValue(null)
    const assistant = 'We decided the release matrix drops Intel Mac forever. '.repeat(3)
    const queued = await queueSessionAutoDistill({
      vaultPath: '/vault',
      userMessage: 'what about intel mac?',
      assistantResponse: assistant,
      startJob,
    })
    expect(queued).toBe(true)
    expect(startJob).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'rhizome_distill',
        args: expect.objectContaining({
          vaultPath: '/vault',
          trigger: 'session_auto',
          text: expect.stringContaining('intel mac'),
        }),
      }),
    )
  })

  it('does not queue when distill already ran mid-turn', async () => {
    const startJob = vi.fn()
    const queued = await queueSessionAutoDistill({
      vaultPath: '/vault',
      userMessage: 'x',
      assistantResponse: 'B'.repeat(100),
      toolNames: ['rhizome_distill'],
      startJob,
    })
    expect(queued).toBe(false)
    expect(startJob).not.toHaveBeenCalled()
  })
})
