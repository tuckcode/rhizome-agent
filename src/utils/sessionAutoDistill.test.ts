import { describe, expect, it, vi } from 'vitest'
import {
  buildSessionAutoDistillText,
  isSessionAutoDistillEnabled,
  isTransientAgentFailureText,
  queueSessionAutoDistill,
  turnAlreadyCalledDistill,
} from './sessionAutoDistill'

describe('sessionAutoDistill', () => {
  it('defaults OFF when unset (explicit promote is the product path)', () => {
    expect(isSessionAutoDistillEnabled(null)).toBe(false)
    expect(isSessionAutoDistillEnabled(undefined)).toBe(false)
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

  // finalResponseText has two empty-turn strings: the generic
  // "<agent> finished without returning a reply" and an OpenCode-specific
  // one. Both are placeholders, so both must be refused — matching only the
  // generic one left OpenCode's variant promotable (found while adding the
  // C51 test seam).
  it('skips the OpenCode empty-turn placeholder', () => {
    const openCodeEmpty = [
      'OpenCode returned no assistant text.',
      'Check the selected provider/model context limit or retry the request.',
      'For large active notes, Rhizome sends a compact note snapshot and OpenCode can read the full file with get_note(path).',
    ].join(' ')
    expect(buildSessionAutoDistillText('hi', openCodeEmpty)).toBeNull()
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

  it('skips a logged-out agent reply so it never becomes a wiki concept', () => {
    expect(isTransientAgentFailureText('Not logged in · Please run /login')).toBe(true)
    expect(isTransientAgentFailureText('Please run /login to continue.')).toBe(true)
    expect(isTransientAgentFailureText('Login flows in OAuth 2.1 use PKCE.')).toBe(false)
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
    expect(queued).toEqual({ queued: true, redactedCount: 0 })
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
    expect(queued).toEqual({ queued: false, redactedCount: 0 })
    expect(startJob).not.toHaveBeenCalled()
  })

  it('strips credential tokens before the distill job sees the turn', async () => {
    const startJob = vi.fn().mockResolvedValue(null)
    const pat = ['ghp', 'A'.repeat(36)].join('_')
    const assistant = 'We decided the release matrix drops Intel Mac forever. '.repeat(3)
    const queued = await queueSessionAutoDistill({
      vaultPath: '/vault',
      userMessage: `the token is ${pat}`,
      assistantResponse: assistant,
      startJob,
    })
    expect(queued).toEqual({ queued: true, redactedCount: 1 })
    const payload = startJob.mock.calls[0]?.[0] as {
      args: { text: string }
    }
    expect(payload.args.text).toContain('[redacted-token]')
    expect(payload.args.text).not.toContain(pat)
  })
})
