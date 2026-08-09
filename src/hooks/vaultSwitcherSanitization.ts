import type { VaultOption } from '../components/StatusBar'

export function sanitizeDefaultWorkspacePath({
  activeVault,
  defaultAvailable,
  defaultWorkspacePath,
  resolvedDefaultPath,
  vaults,
}: {
  activeVault: string | null
  defaultAvailable: boolean
  defaultWorkspacePath: string | null
  resolvedDefaultPath: string
  vaults: VaultOption[]
}): string | null {
  if (!defaultWorkspacePath) {
    return null
  }

  if (defaultWorkspacePath === resolvedDefaultPath) {
    return defaultAvailable ? defaultWorkspacePath : null
  }

  if (vaults.some((vault) => vault.path === defaultWorkspacePath)) {
    return defaultWorkspacePath
  }

  return defaultWorkspacePath === activeVault ? activeVault : null
}
