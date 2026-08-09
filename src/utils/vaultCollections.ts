import type { VaultOption } from '../components/status-bar/types'

function buildPersistedVaultOrder({
  extraVaults,
  hiddenDefaults,
  visibleDefaults,
}: {
  extraVaults: VaultOption[]
  hiddenDefaults: string[]
  visibleDefaults: VaultOption[]
}): VaultOption[] {
  const visibleDefaultsByPath = new Map(visibleDefaults.map((vault) => [vault.path, vault]))
  const orderedVaults: VaultOption[] = []
  const seenPaths = new Set<string>()

  for (const vault of extraVaults) {
    if (hiddenDefaults.includes(vault.path) || seenPaths.has(vault.path)) continue
    const defaultVault = visibleDefaultsByPath.get(vault.path)
    orderedVaults.push(defaultVault ? { ...defaultVault, ...vault, managedDefault: defaultVault.managedDefault } : vault)
    seenPaths.add(vault.path)
  }

  for (const vault of visibleDefaults) {
    if (!seenPaths.has(vault.path)) orderedVaults.push(vault)
  }

  return orderedVaults
}

export function buildAllVaults({
  hiddenDefaults,
  visibleDefaults,
  extraVaults,
}: {
  hiddenDefaults: string[]
  visibleDefaults: VaultOption[]
  extraVaults: VaultOption[]
}): VaultOption[] {
  const visibleDefaultPaths = new Set(visibleDefaults.map((vault) => vault.path))
  const hasPersistedDefaultOrder = extraVaults.some((vault) => visibleDefaultPaths.has(vault.path))

  if (hasPersistedDefaultOrder) {
    return buildPersistedVaultOrder({ extraVaults, hiddenDefaults, visibleDefaults })
  }

  const vaultsByPath = new Map<string, VaultOption>()
  for (const vault of visibleDefaults) vaultsByPath.set(vault.path, vault)
  for (const vault of extraVaults) {
    if (hiddenDefaults.includes(vault.path)) continue
    const existingVault = vaultsByPath.get(vault.path)
    vaultsByPath.set(vault.path, existingVault ? { ...existingVault, ...vault, path: vault.path } : vault)
  }
  return [...vaultsByPath.values()]
}
