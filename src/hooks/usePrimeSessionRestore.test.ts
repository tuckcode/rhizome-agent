import { readFileSync } from 'node:fs'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { usePrimeSessionRestore, resetPrimeSessionRestoreForTests } from './usePrimeSessionRestore'
import type { PrimeHostStatus } from './usePrimeHostStatus'

const { trackEventMock, mockInvokeMock } = vi.hoisted(() => ({
  trackEventMock: vi.fn(),
  mockInvokeMock: vi.fn(),
}))

vi.mock('../lib/telemetry', () => ({ trackEvent: trackEventMock }))
vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: mockInvokeMock,
}))

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

function host(overrides: Partial<PrimeHostStatus> = {}): Pick<PrimeHostStatus, 'running' | 'reattached' | 'sessionPath'> {
  return {
    running: true,
    reattached: false,
    sessionPath: null,
    ...overrides,
  }
}

beforeEach(() => {
  trackEventMock.mockClear()
  mockInvokeMock.mockReset()
  resetPrimeSessionRestoreForTests()
})

describe('usePrimeSessionRestore', () => {
  it('shows the rejoined transcript and does not also open the last disk conversation', async () => {
    mockInvokeMock.mockImplementation(async (command: string) => {
      if (command === 'read_prime_session_transcript') return transcript
      if (command === 'latest_prime_session_for_restore') {
        return { id: 'disk', path: '/sessions/disk.jsonl', mtimeMs: 99, hasConversation: true }
      }
      return null
    })
    const onTranscript = vi.fn()
    const onOpen = vi.fn()
    renderHook(() => usePrimeSessionRestore({
      enabled: true,
      host: host({ reattached: true, sessionPath: '/sessions/live.jsonl' }),
      onTranscript,
      onOpen,
      native: true,
    }))

    await waitFor(() => expect(onTranscript).toHaveBeenCalled())
    expect(mockInvokeMock).toHaveBeenCalledWith('read_prime_session_transcript', {
      path: '/sessions/live.jsonl',
    })
    expect(onTranscript.mock.calls[0][0]).toHaveLength(1)
    expect(onOpen).not.toHaveBeenCalled()
    expect(mockInvokeMock).not.toHaveBeenCalledWith('latest_prime_session_for_restore')
    expect(mockInvokeMock).not.toHaveBeenCalledWith('list_prime_session_summaries')
  })

  it('opens the last disk conversation when the host is up with no session', async () => {
    mockInvokeMock.mockImplementation(async (command: string) => {
      if (command === 'latest_prime_session_for_restore') {
        return { id: 'new', path: '/sessions/new.jsonl', mtimeMs: 9, hasConversation: true }
      }
      return null
    })
    const onOpen = vi.fn()
    renderHook(() => usePrimeSessionRestore({
      enabled: true,
      host: host({ running: true, reattached: false, sessionPath: null }),
      onTranscript: vi.fn(),
      onOpen,
      native: true,
    }))

    await waitFor(() => expect(onOpen).toHaveBeenCalledTimes(1))
    expect(mockInvokeMock).toHaveBeenCalledWith('latest_prime_session_for_restore')
    expect(onOpen.mock.calls[0][0]).toMatchObject({ id: 'new', path: '/sessions/new.jsonl' })
  })

  it('does not treat a running host with no session as a live conversation', async () => {
    mockInvokeMock.mockResolvedValue(null)
    const onTranscript = vi.fn()
    const onOpen = vi.fn()
    renderHook(() => usePrimeSessionRestore({
      enabled: true,
      host: host({ running: true, reattached: false, sessionPath: null }),
      onTranscript,
      onOpen,
      native: true,
    }))

    await waitFor(() => expect(mockInvokeMock).toHaveBeenCalledWith('latest_prime_session_for_restore'))
    expect(onTranscript).not.toHaveBeenCalled()
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('does not steal a session created this runtime', async () => {
    const onTranscript = vi.fn()
    const onOpen = vi.fn()
    renderHook(() => usePrimeSessionRestore({
      enabled: true,
      host: host({ running: true, reattached: false, sessionPath: '/sessions/fresh.jsonl' }),
      onTranscript,
      onOpen,
      native: true,
    }))

    await Promise.resolve()
    expect(mockInvokeMock).not.toHaveBeenCalled()
    expect(onTranscript).not.toHaveBeenCalled()
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('rehydrates once per session rather than on every status poll', async () => {
    mockInvokeMock.mockResolvedValue(transcript)
    const onTranscript = vi.fn()
    const { rerender } = renderHook(() => usePrimeSessionRestore({
      enabled: true,
      host: host({ reattached: true, sessionPath: '/sessions/a.jsonl' }),
      onTranscript,
      onOpen: vi.fn(),
      native: true,
    }))
    await waitFor(() => expect(onTranscript).toHaveBeenCalledTimes(1))

    rerender()
    rerender()
    expect(mockInvokeMock).toHaveBeenCalledTimes(1)
    expect(onTranscript).toHaveBeenCalledTimes(1)
  })

  it('does not run idle restore twice on remount of the same runtime', async () => {
    mockInvokeMock.mockResolvedValue([
      { id: 'a', path: '/sessions/a.jsonl', mtimeMs: 2, hasConversation: true },
    ])
    const onOpen = vi.fn()
    const { rerender } = renderHook(() => usePrimeSessionRestore({
      enabled: true,
      host: host(),
      onTranscript: vi.fn(),
      onOpen,
      native: true,
    }))
    await waitFor(() => expect(onOpen).toHaveBeenCalledTimes(1))
    rerender()
    expect(mockInvokeMock).toHaveBeenCalledTimes(1)
  })

  it('skips idle restore in the browser mock', async () => {
    const onOpen = vi.fn()
    renderHook(() => usePrimeSessionRestore({
      enabled: true,
      host: host(),
      onTranscript: vi.fn(),
      onOpen,
      native: false,
    }))
    await Promise.resolve()
    expect(mockInvokeMock).not.toHaveBeenCalled()
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('leaves the conversation alone when the live transcript reads back empty', async () => {
    mockInvokeMock.mockResolvedValue([])
    const onTranscript = vi.fn()
    renderHook(() => usePrimeSessionRestore({
      enabled: true,
      host: host({ reattached: true, sessionPath: '/sessions/a.jsonl' }),
      onTranscript,
      onOpen: vi.fn(),
      native: true,
    }))

    await Promise.resolve()
    await Promise.resolve()
    expect(onTranscript).not.toHaveBeenCalled()
    expect(trackEventMock).not.toHaveBeenCalled()
  })

  it('does not report an error, and does not block a later session, when the live read fails', async () => {
    mockInvokeMock.mockRejectedValueOnce(new Error('unreadable'))
    const onTranscript = vi.fn()
    const { rerender } = renderHook(
      (props: { sessionPath: string }) => usePrimeSessionRestore({
        enabled: true,
        host: host({ reattached: true, sessionPath: props.sessionPath }),
        onTranscript,
        onOpen: vi.fn(),
        native: true,
      }),
      { initialProps: { sessionPath: '/sessions/a.jsonl' } },
    )
    await waitFor(() => expect(mockInvokeMock).toHaveBeenCalledTimes(1))
    expect(onTranscript).not.toHaveBeenCalled()

    mockInvokeMock.mockResolvedValue(transcript)
    rerender({ sessionPath: '/sessions/b.jsonl' })

    await waitFor(() => expect(onTranscript).toHaveBeenCalled())
  })

  it('reports the reattach without carrying any note content', async () => {
    mockInvokeMock.mockResolvedValue(transcript)
    renderHook(() => usePrimeSessionRestore({
      enabled: true,
      host: host({ reattached: true, sessionPath: '/sessions/a.jsonl' }),
      onTranscript: vi.fn(),
      onOpen: vi.fn(),
      native: true,
    }))

    await waitFor(() => expect(trackEventMock).toHaveBeenCalled())
    expect(trackEventMock).toHaveBeenCalledWith('prime_session_reattached', { messages: 1 })
    const [, properties] = trackEventMock.mock.calls[0]
    expect(JSON.stringify(properties)).not.toContain('hi')
    expect(JSON.stringify(properties)).not.toContain('.jsonl')
  })

  it('does not require a vault path — last conversation lives on Prime disk', () => {
    const source = readFileSync(`${process.cwd()}/src/hooks/usePrimeSessionRestore.ts`, 'utf8')
    expect(source).not.toContain('vaultPath')
  })

  it('does nothing when Chat is not on Prime', async () => {
    const onTranscript = vi.fn()
    const onOpen = vi.fn()
    renderHook(() => usePrimeSessionRestore({
      enabled: false,
      host: host({ reattached: true, sessionPath: '/sessions/a.jsonl' }),
      onTranscript,
      onOpen,
      native: true,
    }))
    await Promise.resolve()
    expect(mockInvokeMock).not.toHaveBeenCalled()
    expect(onTranscript).not.toHaveBeenCalled()
    expect(onOpen).not.toHaveBeenCalled()
  })
})
