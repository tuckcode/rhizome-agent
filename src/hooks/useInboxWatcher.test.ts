import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useInboxWatcher } from './useInboxWatcher'
import { isTauri } from '../mock-tauri'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}))
vi.mock('../mock-tauri', () => ({
  isTauri: vi.fn(() => true),
}))

describe('useInboxWatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isTauri).mockReturnValue(true)
    vi.mocked(invoke).mockResolvedValue(undefined)
    vi.mocked(listen).mockResolvedValue(() => {})
  })

  it('does nothing when disabled', () => {
    renderHook(() => useInboxWatcher('/vault', false, vi.fn()))
    expect(invoke).not.toHaveBeenCalled()
    expect(listen).not.toHaveBeenCalled()
  })

  it('does nothing for an empty vault path', () => {
    renderHook(() => useInboxWatcher('', true, vi.fn()))
    expect(invoke).not.toHaveBeenCalled()
  })

  it('does nothing outside Tauri (browser/mock mode)', () => {
    vi.mocked(isTauri).mockReturnValue(false)
    renderHook(() => useInboxWatcher('/vault', true, vi.fn()))
    expect(invoke).not.toHaveBeenCalled()
  })

  it('starts the watcher and subscribes to events when enabled', async () => {
    renderHook(() => useInboxWatcher('/vault', true, vi.fn()))
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('start_inbox_watcher', { vaultPath: '/vault' })
    })
    expect(listen).toHaveBeenCalledWith('inbox-processed', expect.any(Function))
    expect(listen).toHaveBeenCalledWith('inbox-error', expect.any(Function))
  })

  it('stops the watcher on unmount', async () => {
    const { unmount } = renderHook(() => useInboxWatcher('/vault', true, vi.fn()))
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('start_inbox_watcher', expect.anything()))
    unmount()
    expect(invoke).toHaveBeenCalledWith('stop_inbox_watcher')
  })

  it('toasts on an inbox-processed event for the active vault', async () => {
    const onToast = vi.fn()
    let processedHandler: ((e: { payload: unknown }) => void) | undefined
    vi.mocked(listen).mockImplementation((event: string, handler: (e: { payload: unknown }) => void) => {
      if (event === 'inbox-processed') processedHandler = handler
      return Promise.resolve(() => {})
    })

    renderHook(() => useInboxWatcher('/vault', true, onToast))
    await waitFor(() => expect(processedHandler).toBeDefined())

    processedHandler!({ payload: { vaultPath: '/vault', artifactPath: 'wiki/concepts/idea.md' } })
    expect(onToast).toHaveBeenCalledWith('Inbox: processed idea.md')
  })
})
