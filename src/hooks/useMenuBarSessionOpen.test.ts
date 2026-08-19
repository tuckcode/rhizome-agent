import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { MENU_BAR_OPEN_SESSION_EVENT, useMenuBarSessionOpen } from './useMenuBarSessionOpen'

const listenMock = vi.fn()
const unlistenMock = vi.fn()

vi.mock('@tauri-apps/api/event', () => ({
  listen: (...args: unknown[]) => listenMock(...args),
}))

vi.mock('../mock-tauri', () => ({
  isTauri: () => true,
}))

/** Capture the handler the hook registers so tests can fire the event. */
function registeredHandler(): (event: { payload: unknown }) => void {
  const call = listenMock.mock.calls.find(([name]) => name === MENU_BAR_OPEN_SESSION_EVENT)
  if (!call) throw new Error('hook did not subscribe')
  return call[1] as (event: { payload: unknown }) => void
}

describe('useMenuBarSessionOpen', () => {
  beforeEach(() => {
    listenMock.mockReset()
    unlistenMock.mockReset()
    listenMock.mockResolvedValue(unlistenMock)
  })

  it('opens the session named in the payload', async () => {
    const onOpen = vi.fn()
    renderHook(() => useMenuBarSessionOpen(onOpen))
    await waitFor(() => expect(listenMock).toHaveBeenCalled())

    registeredHandler()({ payload: '/sessions/root.jsonl' })
    expect(onOpen).toHaveBeenCalledWith('/sessions/root.jsonl')
  })

  it('ignores an empty or non-string payload', async () => {
    // The payload crosses a process boundary; switching the panel to "" would
    // read to the user as the session vanishing.
    const onOpen = vi.fn()
    renderHook(() => useMenuBarSessionOpen(onOpen))
    await waitFor(() => expect(listenMock).toHaveBeenCalled())

    const handler = registeredHandler()
    handler({ payload: '' })
    handler({ payload: null })
    handler({ payload: 42 })
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('unsubscribes on unmount', async () => {
    const { unmount } = renderHook(() => useMenuBarSessionOpen(vi.fn()))
    await waitFor(() => expect(listenMock).toHaveBeenCalled())
    unmount()
    await waitFor(() => expect(unlistenMock).toHaveBeenCalled())
  })
})
