import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type { Settings } from '../types'
import { useWorkspaceGraphState } from './useWorkspaceGraphState'

const mockInvokeFn = vi.fn((cmd: string, args?: Record<string, unknown>): Promise<unknown> => {
  if (cmd === 'sync_mcp_bridge_vault') {
    return Promise.resolve(args?.vaultPath ? 'started' : 'stopped')
  }
  return Promise.resolve(null)
})

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: (cmd: string, args?: Record<string, unknown>) => mockInvokeFn(cmd, args),
}))

const baseSettings = {
  multi_workspace_enabled: false,
} as Settings

describe('useWorkspaceGraphState MCP bridge sync', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockInvokeFn.mockImplementation((cmd: string, args?: Record<string, unknown>): Promise<unknown> => {
      if (cmd === 'sync_mcp_bridge_vault') {
        return Promise.resolve(args?.vaultPath ? 'started' : 'stopped')
      }
      return Promise.resolve(null)
    })
  })

  it('syncs vaultPath and vaultPaths together so active_vaults is never empty for a live vault', async () => {
    renderHook(() => useWorkspaceGraphState({
      allVaults: [{ label: 'Work', path: '/work/vault', available: true }],
      defaultWorkspacePath: null,
      resolvedPath: '/work/vault',
      settings: baseSettings,
      vaultSwitcherLoaded: true,
      windowMode: false,
    }))

    await waitFor(() => {
      expect(mockInvokeFn).toHaveBeenCalledWith('sync_mcp_bridge_vault', {
        vaultPath: '/work/vault',
        vaultPaths: ['/work/vault'],
      })
    })
  })

  it('does not sync from a companion window (main workspace owns the bridge)', async () => {
    renderHook(() => useWorkspaceGraphState({
      allVaults: [{ label: 'Work', path: '/work/vault', available: true }],
      defaultWorkspacePath: null,
      resolvedPath: '/work/vault',
      settings: baseSettings,
      vaultSwitcherLoaded: true,
      windowMode: true,
    }))

    await waitFor(() => {
      expect(mockInvokeFn).not.toHaveBeenCalledWith(
        'sync_mcp_bridge_vault',
        expect.anything(),
      )
    })
  })
})
