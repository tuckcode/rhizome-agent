import type { VaultOption } from '../components/status-bar/types'
import { labelFromWorkspacePath, workspaceLabelFromVault } from './workspaces'

export interface GitRepositoryOption {
  path: string
  label: string
  defaultForNewNotes: boolean
}

interface GitRepositoryOptionsInput {
  defaultVaultPath: string
  multiWorkspaceEnabled: boolean
  vaults: VaultOption[]
}

function repositoryLabel(vault: Pick<VaultOption, 'label' | 'path'>): string {
  return workspaceLabelFromVault(vault)
}

function includeVaultAsActiveRepository(
  vault: Pick<VaultOption, 'available' | 'managedDefault' | 'mounted' | 'path'>,
  defaultVaultPath: string,
): boolean {
  if (!vault.path.trim()) return false
  if (vault.available === false) return false
  if (vault.path === defaultVaultPath) return true
  return vault.mounted !== false
}

function addRepository(
  repositories: Map<string, GitRepositoryOption>,
  vault: Pick<VaultOption, 'label' | 'path'>,
  defaultVaultPath: string,
): void {
  if (!vault.path.trim() || repositories.has(vault.path)) return
  repositories.set(vault.path, {
    path: vault.path,
    label: repositoryLabel(vault),
    defaultForNewNotes: vault.path === defaultVaultPath,
  })
}

export function activeGitRepositories({
  defaultVaultPath,
  multiWorkspaceEnabled,
  vaults,
}: GitRepositoryOptionsInput): GitRepositoryOption[] {
  const repositories = new Map<string, GitRepositoryOption>()
  const defaultVault = vaults.find((vault) => vault.path === defaultVaultPath)
  if (defaultVaultPath.trim()) {
    addRepository(repositories, defaultVault ?? { label: labelFromWorkspacePath(defaultVaultPath), path: defaultVaultPath }, defaultVaultPath)
  }

  if (!multiWorkspaceEnabled) return [...repositories.values()]

  for (const vault of vaults) {
    if (includeVaultAsActiveRepository(vault, defaultVaultPath)) {
      addRepository(repositories, vault, defaultVaultPath)
    }
  }

  return [...repositories.values()]
}

export function validGitRepositoryPath(
  path: string | null | undefined,
  repositories: readonly GitRepositoryOption[],
  fallbackPath: string,
): string {
  if (path && repositories.some((repository) => repository.path === path)) return path
  if (repositories.some((repository) => repository.path === fallbackPath)) return fallbackPath
  return repositories[0]?.path ?? fallbackPath
}

export function gitRepositoryLabel(
  path: string,
  repositories: readonly GitRepositoryOption[],
): string {
  return repositories.find((repository) => repository.path === path)?.label ?? labelFromWorkspacePath(path)
}
