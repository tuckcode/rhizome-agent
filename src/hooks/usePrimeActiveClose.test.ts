import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { PRIME_ACTIVE_CLOSE_EVENT, usePrimeActiveClose } from './usePrimeActiveClose'

const listenMock = vi.fn()
const unlistenMock = vi.fn()
const hideMock = vi.fn()
const invoked = vi.hoisted(() => ({
  calls: [] as Array<{ cmd: string; args?: Record<string, unknown> }>,
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: (...args: unknown[]) => listenMock(...args),
}))

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ hide: hideMock }),
}))

vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: (cmd: string, args?: Record<string, unknown>) => {
    invoked.calls.push({ cmd, args })
    return Promise.resolve({ outcome: 'stop_session' })
  },
}))

function registeredHandler(): () => void {
  const call = listenMock.mock.calls.find(([name]) => name === PRIME_ACTIVE_CLOSE_EVENT)
  if (!call) throw new Error('hook did not subscribe')
  return call[1] as () => void
}

describe('usePrimeActiveClose', () => {
  beforeEach(() => {
    listenMock.mockReset()
    unlistenMock.mockReset()
    hideMock.mockReset()
    hideMock.mockResolvedValue(undefined)
    invoked.calls = []
    listenMock.mockResolvedValue(unlistenMock)
  })

  it('opens when Rust asks about an active close', async () => {
    const { result } = renderHook(() => usePrimeActiveClose())
    await waitFor(() => expect(listenMock).toHaveBeenCalled())
    expect(result.current.open).toBe(false)

    act(() => {
      registeredHandler()()
    })
    expect(result.current.open).toBe(true)
  })

  it('stop and close settles with stop, then hides', async () => {
    const { result } = renderHook(() => usePrimeActiveClose())
    await waitFor(() => expect(listenMock).toHaveBeenCalled())
    act(() => {
      registeredHandler()()
    })

    await act(async () => {
      result.current.stopAndClose()
    })

    expect(invoked.calls).toEqual([
      { cmd: 'settle_prime_session', args: { intent: 'stop' } },
    ])
    expect(hideMock).toHaveBeenCalled()
    expect(result.current.open).toBe(false)
  })

  it('keep working settles with keep_working, then hides', async () => {
    const { result } = renderHook(() => usePrimeActiveClose())
    await waitFor(() => expect(listenMock).toHaveBeenCalled())
    act(() => {
      registeredHandler()()
    })

    await act(async () => {
      result.current.keepWorking()
    })

    expect(invoked.calls).toEqual([
      { cmd: 'settle_prime_session', args: { intent: 'keep_working' } },
    ])
    expect(hideMock).toHaveBeenCalled()
  })

  it('cancel leaves the window open and does not settle', async () => {
    const { result } = renderHook(() => usePrimeActiveClose())
    await waitFor(() => expect(listenMock).toHaveBeenCalled())
    act(() => {
      registeredHandler()()
    })
    act(() => {
      result.current.cancel()
    })
    expect(result.current.open).toBe(false)
    expect(invoked.calls).toEqual([])
    expect(hideMock).not.toHaveBeenCalled()
  })
})
