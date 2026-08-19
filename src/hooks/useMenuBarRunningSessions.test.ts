import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useMenuBarRunningSessions } from './useMenuBarRunningSessions'

const invokeMock = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}))

vi.mock('../mock-tauri', () => ({
  isTauri: () => true,
}))

function working(id: string) {
  return {
    id,
    activeSessionId: id,
    activity: 'working',
    runtimeKind: 'top-level',
    rlmDepth: 0,
    firstMessage: `session ${id}`,
  }
}

describe('useMenuBarRunningSessions', () => {
  beforeEach(() => {
    invokeMock.mockReset()
    invokeMock.mockResolvedValue([working('a')])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('fetches once on mount without waiting to be told to poll', async () => {
    // The popover is built and shown together; a first paint gated on a focus
    // event shows an empty roster until that event lands, or forever if it
    // never does.
    const { result } = renderHook(() => useMenuBarRunningSessions())
    await waitFor(() => expect(result.current.rows).toHaveLength(1))
    expect(result.current.rows[0].id).toBe('a')
  })

  it('keeps the previous rows when a poll fails', async () => {
    const { result } = renderHook(() => useMenuBarRunningSessions())
    await waitFor(() => expect(result.current.rows).toHaveLength(1))

    invokeMock.mockRejectedValueOnce(new Error('daemon went away'))
    await act(async () => {
      result.current.refresh()
    })
    expect(result.current.rows).toHaveLength(1)
  })

  it('does not poll until asked, then polls on an interval', async () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useMenuBarRunningSessions())
    // Let the mount fetch settle inside act before touching timers.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(invokeMock).toHaveBeenCalledTimes(1)

    // Hidden: the mount fetch happened, but no timer is running.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(12_000)
    })
    expect(invokeMock).toHaveBeenCalledTimes(1)

    act(() => {
      result.current.setPolling(true)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_000)
    })
    expect(invokeMock.mock.calls.length).toBeGreaterThan(1)
  })

  it('stops polling when the popover hides', async () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useMenuBarRunningSessions())
    // Let the mount fetch settle inside act before touching timers.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(invokeMock).toHaveBeenCalledTimes(1)

    act(() => {
      result.current.setPolling(true)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_000)
    })
    const whilePolling = invokeMock.mock.calls.length

    act(() => {
      result.current.setPolling(false)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000)
    })
    expect(invokeMock.mock.calls.length).toBe(whilePolling)
  })

  it('does not stack overlapping polls', async () => {
    // A roster call slower than the interval must not queue up behind it and
    // deliver answers out of order.
    let release: (value: unknown) => void = () => {}
    invokeMock.mockImplementation(
      () => new Promise((resolve) => {
        release = resolve
      }),
    )
    const { result } = renderHook(() => useMenuBarRunningSessions())
    await act(async () => {})
    expect(invokeMock).toHaveBeenCalledTimes(1)

    act(() => {
      result.current.refresh()
      result.current.refresh()
    })
    expect(invokeMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      release([working('a')])
    })
  })
})
