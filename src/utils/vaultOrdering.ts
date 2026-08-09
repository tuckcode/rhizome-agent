import type { VaultOption } from '../components/status-bar/types'

export type VaultMoveDirection = 'up' | 'down'

export function vaultPathList(vaults: VaultOption[]): string[] {
  return vaults.map((vault) => vault.path)
}

export function orderVaultsByPath(vaults: VaultOption[], orderedPaths: string[]): VaultOption[] | null {
  if (vaults.length !== orderedPaths.length) return null

  const vaultsByPath = new Map(vaults.map((vault) => [vault.path, vault]))
  const orderedVaults: VaultOption[] = []

  for (const path of orderedPaths) {
    const vault = vaultsByPath.get(path)
    if (!vault) return null
    orderedVaults.push(vault)
  }

  return orderedVaults
}

export function moveVaultPath(vaults: VaultOption[], path: string, direction: VaultMoveDirection): string[] | null {
  const orderedPaths = vaultPathList(vaults)
  const currentIndex = orderedPaths.indexOf(path)
  if (currentIndex === -1) return null

  const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
  if (nextIndex < 0 || nextIndex >= orderedPaths.length) return null

  const nextPaths = [...orderedPaths]
  const [movedPath] = nextPaths.splice(currentIndex, 1)
  nextPaths.splice(nextIndex, 0, movedPath)
  return nextPaths
}

export function reorderVaultPath(vaults: VaultOption[], activePath: string, overPath: string): string[] | null {
  if (activePath === overPath) return null

  const orderedPaths = vaultPathList(vaults)
  const activeIndex = orderedPaths.indexOf(activePath)
  const overIndex = orderedPaths.indexOf(overPath)
  if (activeIndex === -1 || overIndex === -1) return null

  const nextPaths = [...orderedPaths]
  const [movedPath] = nextPaths.splice(activeIndex, 1)
  nextPaths.splice(overIndex, 0, movedPath)
  return nextPaths
}

export function canMoveVaultPath(vaults: VaultOption[], path: string, direction: VaultMoveDirection): boolean {
  return moveVaultPath(vaults, path, direction) !== null
}
