import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { usePrimeSessionRehydrate } from './usePrimeSessionRehydrate'

const { trackEventMock, mockInvokeMock } = vi.hoisted(() => ({
  trackEventMock: vi.fn(),
  mockInvokeMock: vi.fn(),
}))

vi.mock('../lib/telemetry', () => ({ trackEvent: trackEventMock }))
vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: mockInvokeMock,
}))

/**
 * One user turn plus its reply, in the shape `read_prime_session_transcript`
 * actually returns — the message is nested under `message`, not flattened onto
 * the item. Copied from `primeTranscriptToConversation.test.ts` rather than
 * written from a reading of the type: a hand-authored fixture here produced a
 * conversion that silently yielded zero turns, which is the same class of
 * defect this repo hit with `model_change` and `tool_use` vs `toolCall`.
 */
const transcript = [
  {
    kind: 'message',
    id: 'e1',
    message: { role: 'user', content: [{ type: 'text', text: 'hi' }], text: 'hi' },
  },
  {
    kind: 'message',
    id: 'e2',
    message: { role: 'assistant', content: [{ type: 'text', text: 'hello' }], text: 'hello' },
  },
]

beforeEach(() => {
  trackEventMock.mockClear()
  mockInvokeMock.mockReset()
  mockInvokeMock.mockResolvedValue(transcript)
})

const options = (overrides: Record<string, unknown> = {}) => ({
  enabled: true,
  reattached: true,
  sessionPath: '/sessions/a.jsonl',
  onTranscript: vi.fn(),
  ...overrides,
})

describe('usePrimeSessionRehydrate', () => {
  /// Reopening lands in a session the daemon kept running. Showing an empty
  /// panel over it would make the transcript lie about its own history.
  it('shows the transcript of the session it rejoined', async () => {
    const opts = options()
    renderHook(() => usePrimeSessionRehydrate(opts))

    await waitFor(() => expect(opts.onTranscript).toHaveBeenCalled())
    expect(mockInvokeMock).toHaveBeenCalledWith('read_prime_session_transcript', {
      path: '/sessions/a.jsonl',
    })
    expect(opts.onTranscript.mock.calls[0][0]).toHaveLength(1)
  })

  /// Host status is polled every few seconds. Without a guard, every poll
  /// would replace the conversation and fight the live stream for it.
  it('rehydrates once per session rather than on every status poll', async () => {
    const opts = options()
    const { rerender } = renderHook(() => usePrimeSessionRehydrate(opts))
    await waitFor(() => expect(opts.onTranscript).toHaveBeenCalledTimes(1))

    rerender()
    rerender()

    expect(mockInvokeMock).toHaveBeenCalledTimes(1)
    expect(opts.onTranscript).toHaveBeenCalledTimes(1)
  })

  /// A freshly created session has nothing to rejoin, so touching the
  /// conversation would only risk clobbering it.
  it('does nothing when the session was created rather than rejoined', async () => {
    const opts = options({ reattached: false })
    renderHook(() => usePrimeSessionRehydrate(opts))

    await Promise.resolve()
    expect(mockInvokeMock).not.toHaveBeenCalled()
    expect(opts.onTranscript).not.toHaveBeenCalled()
  })

  it('does nothing for a non-Prime target', async () => {
    const opts = options({ enabled: false })
    renderHook(() => usePrimeSessionRehydrate(opts))

    await Promise.resolve()
    expect(mockInvokeMock).not.toHaveBeenCalled()
  })

  /// Prime may not have flushed the log yet. Blanking the panel would look
  /// like the work was lost, which is the opposite of what #7 promises.
  it('leaves the conversation alone when the transcript reads back empty', async () => {
    mockInvokeMock.mockResolvedValue([])
    const opts = options()
    renderHook(() => usePrimeSessionRehydrate(opts))

    await Promise.resolve()
    await Promise.resolve()
    expect(opts.onTranscript).not.toHaveBeenCalled()
    expect(trackEventMock).not.toHaveBeenCalled()
  })

  /// The session is attached and live whether or not its log can be read, so
  /// a failure must neither surface as an error nor poison the guard against
  /// a later attempt.
  ///
  /// "Later" means the next time the effect runs — a switch to another session
  /// or a remount. It is deliberately not a retry loop: nothing here polls, so
  /// a transient read failure leaves the panel empty over a live session until
  /// something else moves. Worth revisiting if it is ever seen in practice.
  it('does not report an error, and does not block a later session, when the read fails', async () => {
    mockInvokeMock.mockRejectedValueOnce(new Error('unreadable'))
    const opts = options()
    const { rerender } = renderHook(
      (props: { sessionPath: string }) =>
        usePrimeSessionRehydrate({ ...opts, sessionPath: props.sessionPath }),
      { initialProps: { sessionPath: '/sessions/a.jsonl' } },
    )
    await waitFor(() => expect(mockInvokeMock).toHaveBeenCalledTimes(1))
    expect(opts.onTranscript).not.toHaveBeenCalled()

    mockInvokeMock.mockResolvedValue(transcript)
    rerender({ sessionPath: '/sessions/b.jsonl' })

    await waitFor(() => expect(opts.onTranscript).toHaveBeenCalled())
  })

  /// Adoption of a resumed session is worth measuring; its content is not.
  it('reports the reattach without carrying any note content', async () => {
    const opts = options()
    renderHook(() => usePrimeSessionRehydrate(opts))

    await waitFor(() => expect(trackEventMock).toHaveBeenCalled())
    expect(trackEventMock).toHaveBeenCalledWith('prime_session_reattached', { messages: 1 })
    const [, properties] = trackEventMock.mock.calls[0]
    expect(JSON.stringify(properties)).not.toContain('hi')
    expect(JSON.stringify(properties)).not.toContain('.jsonl')
  })
})
