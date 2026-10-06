import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { PRIME_ACTIVE_CLOSE_EVENT, usePrimeActiveClose } from './usePrimeActiveClose'

const listenMock = vi.fn()
const unlistenMock = vi.fn()
const { invoked, tauri } = vi.hoisted(() => ({
  invoked: { calls: [] as Array<{ cmd: string; args?: Record<string, unknown> }> },
  tauri: { on: true },
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: (...args: unknown[]) => listenMock(...args),
}))

vi.mock('../mock-tauri', () => ({
  isTauri: () => tauri.on,
}))

vi.mock('../lib/callHost', () => ({
  callHost: (cmd: string, args?: Record<string, unknown>) => {
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
    invoked.calls = []
    tauri.on = true
    listenMock.mockResolvedValue(unlistenMock)
  })

  it('does not touch Tauri listen in the browser', async () => {
    tauri.on = false
    renderHook(() => usePrimeActiveClose())
    await Promise.resolve()
    expect(listenMock).not.toHaveBeenCalled()
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

  it('stop and close settles with stop, then finishes the close', async () => {
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
      { cmd: 'finish_main_window_close' },
    ])
    expect(result.current.open).toBe(false)
  })

  it('keep working settles with keep_working, then finishes the close', async () => {
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
      { cmd: 'finish_main_window_close' },
    ])
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
  })
})
