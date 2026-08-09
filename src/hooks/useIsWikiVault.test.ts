import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useIsWikiVault } from './useIsWikiVault'
import * as vaultLoaderCommands from './vaultLoaderCommands'

describe('useIsWikiVault', () => {
  it('returns false for an empty vault path without calling the command', async () => {
    const spy = vi.spyOn(vaultLoaderCommands, 'checkIsWikiVault')
    const { result } = renderHook(() => useIsWikiVault(''))
    expect(result.current).toBe(false)
    expect(spy).not.toHaveBeenCalled()
  })

  it('resolves to true when the command reports a wiki vault', async () => {
    vi.spyOn(vaultLoaderCommands, 'checkIsWikiVault').mockResolvedValue(true)
    const { result } = renderHook(() => useIsWikiVault('/vault'))
    await waitFor(() => expect(result.current).toBe(true))
  })

  it('resolves to false when the command reports a personal vault', async () => {
    vi.spyOn(vaultLoaderCommands, 'checkIsWikiVault').mockResolvedValue(false)
    const { result } = renderHook(() => useIsWikiVault('/vault'))
    await waitFor(() => expect(result.current).toBe(false))
  })

  it('re-checks when the vault path changes', async () => {
    const spy = vi.spyOn(vaultLoaderCommands, 'checkIsWikiVault').mockImplementation(
      ({ vaultPath }) => Promise.resolve(vaultPath === '/vault-b')
    )
    const { result, rerender } = renderHook(({ path }) => useIsWikiVault(path), {
      initialProps: { path: '/vault-a' },
    })
    await waitFor(() => expect(result.current).toBe(false))

    rerender({ path: '/vault-b' })
    await waitFor(() => expect(result.current).toBe(true))
    expect(spy).toHaveBeenCalledWith({ vaultPath: '/vault-b' })
  })
})
