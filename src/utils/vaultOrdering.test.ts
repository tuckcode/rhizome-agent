import { describe, expect, it } from 'vitest'
import type { VaultOption } from '../components/status-bar/types'
import { canMoveVaultPath, moveVaultPath, orderVaultsByPath, reorderVaultPath, vaultPathList } from './vaultOrdering'

const vaults: VaultOption[] = [
  { label: 'Vault', path: '/vault' },
  { label: 'Research', path: '/research' },
  { label: 'Archive', path: '/archive' },
]

describe('vaultOrdering', () => {
  it('extracts vault paths in display order', () => {
    expect(vaultPathList(vaults)).toEqual(['/vault', '/research', '/archive'])
  })

  it('orders vaults by a complete path list', () => {
    expect(orderVaultsByPath(vaults, ['/archive', '/vault', '/research'])).toEqual([
      vaults[2],
      vaults[0],
      vaults[1],
    ])
  })

  it('rejects incomplete or unknown path lists', () => {
    expect(orderVaultsByPath(vaults, ['/archive', '/vault'])).toBeNull()
    expect(orderVaultsByPath(vaults, ['/archive', '/vault', '/missing'])).toBeNull()
  })

  it('moves vault paths one slot at a time', () => {
    expect(moveVaultPath(vaults, '/research', 'up')).toEqual(['/research', '/vault', '/archive'])
    expect(moveVaultPath(vaults, '/research', 'down')).toEqual(['/vault', '/archive', '/research'])
  })

  it('reorders a dragged vault path to the hovered path index', () => {
    expect(reorderVaultPath(vaults, '/vault', '/archive')).toEqual(['/research', '/archive', '/vault'])
    expect(reorderVaultPath(vaults, '/archive', '/vault')).toEqual(['/archive', '/vault', '/research'])
  })

  it('ignores no-op or unknown drag reorder paths', () => {
    expect(reorderVaultPath(vaults, '/research', '/research')).toBeNull()
    expect(reorderVaultPath(vaults, '/missing', '/archive')).toBeNull()
    expect(reorderVaultPath(vaults, '/archive', '/missing')).toBeNull()
  })

  it('reports whether a vault can move in a direction', () => {
    expect(canMoveVaultPath(vaults, '/vault', 'up')).toBe(false)
    expect(canMoveVaultPath(vaults, '/vault', 'down')).toBe(true)
    expect(canMoveVaultPath(vaults, '/archive', 'down')).toBe(false)
  })
})
