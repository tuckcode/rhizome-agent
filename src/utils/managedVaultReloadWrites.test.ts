import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  managedVaultReloadWritePaths,
  setManagedVaultReloadWriteMarker,
  suppressManagedVaultReloadWatcherFeedback,
} from './managedVaultReloadWrites'

describe('managedVaultReloadWritePaths', () => {
  it('returns AGENTS.md under the vault root', () => {
    expect(managedVaultReloadWritePaths('/Users/me/vault')).toEqual([
      '/Users/me/vault/AGENTS.md',
    ])
  })

  it('normalizes trailing slashes and backslashes', () => {
    expect(managedVaultReloadWritePaths('C:\\Users\\me\\vault\\')).toEqual([
      'C:/Users/me/vault/AGENTS.md',
    ])
  })

  it('returns nothing for empty vault paths', () => {
    expect(managedVaultReloadWritePaths('')).toEqual([])
    expect(managedVaultReloadWritePaths('   ')).toEqual([])
  })
})

describe('suppressManagedVaultReloadWatcherFeedback', () => {
  afterEach(() => {
    setManagedVaultReloadWriteMarker(null)
  })

  it('marks managed reload write paths when a marker is registered', () => {
    const marker = vi.fn()
    setManagedVaultReloadWriteMarker(marker)

    suppressManagedVaultReloadWatcherFeedback('/vault')

    expect(marker).toHaveBeenCalledExactlyOnceWith('/vault/AGENTS.md')
  })

  it('is a no-op when no marker is registered', () => {
    expect(() => suppressManagedVaultReloadWatcherFeedback('/vault')).not.toThrow()
  })
})
