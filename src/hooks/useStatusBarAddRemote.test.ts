import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GitRemoteStatus } from '../types'
import { REQUEST_ADD_REMOTE_EVENT } from '../utils/addRemoteEvents'
import { useStatusBarAddRemote } from './useStatusBarAddRemote'

const invokeMock = vi.fn()
const mockInvokeMock = vi.fn()
const isTauriMock = vi.fn(() => false)

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}))

vi.mock('../mock-tauri', () => ({
  isTauri: () => isTauriMock(),
  mockInvoke: (...args: unknown[]) => mockInvokeMock(...args),
}))

function remoteStatus(hasRemote: boolean): GitRemoteStatus {
  return {
    branch: 'main',
    ahead: 0,
    behind: 0,
    hasRemote,
  }
}

describe('useStatusBarAddRemote', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isTauriMock.mockReturnValue(false)
    mockInvokeMock.mockResolvedValue(remoteStatus(false))
    invokeMock.mockResolvedValue(remoteStatus(false))
  })

  it('delegates to onAddRemote when provided', async () => {
    const onAddRemote = vi.fn()
    const { result } = renderHook(() =>
      useStatusBarAddRemote({
        vaultPath: '/vault',
        isGitVault: true,
        remoteStatus: remoteStatus(false),
        onAddRemote,
      }),
    )

    await act(async () => {
      await result.current.openAddRemote()
    })

    expect(onAddRemote).toHaveBeenCalledTimes(1)
    expect(mockInvokeMock).not.toHaveBeenCalled()
    expect(result.current.showAddRemote).toBe(false)
  })

  it('does nothing when the vault is not git-backed', async () => {
    const { result } = renderHook(() =>
      useStatusBarAddRemote({
        vaultPath: '/vault',
        isGitVault: false,
        remoteStatus: remoteStatus(false),
      }),
    )

    await act(async () => {
      await result.current.openAddRemote()
    })

    expect(result.current.showAddRemote).toBe(false)
    expect(mockInvokeMock).not.toHaveBeenCalled()
  })

  it('opens when the refreshed remote status has no remote and closes when it does', async () => {
    const { result, rerender } = renderHook(
      ({ remote }) =>
        useStatusBarAddRemote({
          vaultPath: '/vault',
          isGitVault: true,
          remoteStatus: remote,
        }),
      {
        initialProps: { remote: remoteStatus(false) },
      },
    )

    await act(async () => {
      await result.current.openAddRemote()
    })

    expect(mockInvokeMock).toHaveBeenCalledWith('git_remote_status', { vaultPath: '/vault' })
    expect(result.current.showAddRemote).toBe(true)
    expect(result.current.visibleRemoteStatus).toEqual(remoteStatus(false))

    mockInvokeMock.mockResolvedValue(remoteStatus(true))

    await act(async () => {
      await result.current.handleRemoteConnected('connected')
    })

    expect(result.current.visibleRemoteStatus).toEqual(remoteStatus(true))

    await act(async () => {
      result.current.closeAddRemote()
    })
    expect(result.current.showAddRemote).toBe(false)

    rerender({ remote: remoteStatus(false) })
    expect(result.current.visibleRemoteStatus).toEqual(remoteStatus(true))
  })

  it('stays closed when the latest refresh already has a remote', async () => {
    mockInvokeMock.mockResolvedValue(remoteStatus(true))

    const { result } = renderHook(() =>
      useStatusBarAddRemote({
        vaultPath: '/vault',
        isGitVault: true,
        remoteStatus: remoteStatus(false),
      }),
    )

    await act(async () => {
      await result.current.openAddRemote()
    })

    expect(result.current.showAddRemote).toBe(false)
    expect(result.current.visibleRemoteStatus).toEqual(remoteStatus(true))
  })

  it('reacts to the global add-remote request event', async () => {
    const { result } = renderHook(() =>
      useStatusBarAddRemote({
        vaultPath: '/vault',
        isGitVault: true,
        remoteStatus: remoteStatus(false),
      }),
    )

    await act(async () => {
      window.dispatchEvent(new Event(REQUEST_ADD_REMOTE_EVENT))
    })

    await waitFor(() => {
      expect(result.current.showAddRemote).toBe(true)
    })
  })

  it('uses the Tauri invoke path in native mode and tolerates refresh failures', async () => {
    isTauriMock.mockReturnValue(true)
    invokeMock
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(remoteStatus(true))

    const { result } = renderHook(() =>
      useStatusBarAddRemote({
        vaultPath: '/vault',
        isGitVault: true,
        remoteStatus: null,
      }),
    )

    await act(async () => {
      await result.current.openAddRemote()
    })
    expect(result.current.showAddRemote).toBe(true)

    await act(async () => {
      await result.current.handleRemoteConnected('connected')
    })
    expect(result.current.visibleRemoteStatus).toEqual(remoteStatus(true))
  })
})
