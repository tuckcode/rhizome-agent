import { useCallback, type Dispatch, type SetStateAction } from 'react'
import type { VaultOption } from '../components/status-bar/types'
import { labelFromWorkspacePath } from '../utils/workspaces'

function updateVaultOptionInList(
  path: string,
  patch: Partial<VaultOption>,
): (vaults: VaultOption[]) => VaultOption[] {
  const safePatch = { ...patch }
  delete safePatch.path

  return (vaults) => {
    let updated = false
    const nextVaults = vaults.map((vault) => {
      if (vault.path !== path) return vault
      updated = true
      return { ...vault, ...safePatch, path: vault.path }
    })

    if (updated) return nextVaults

    return [
      ...nextVaults,
      {
        label: labelFromWorkspacePath(path),
        path,
        available: true,
        ...safePatch,
      },
    ]
  }
}

export function useWorkspaceIdentityActions({
  setDefaultWorkspacePath,
  setExtraVaults,
}: {
  setDefaultWorkspacePath: Dispatch<SetStateAction<string | null>>
  setExtraVaults: Dispatch<SetStateAction<VaultOption[]>>
}) {
  const updateWorkspaceIdentity = useCallback((path: string, patch: Partial<VaultOption>) => {
    setExtraVaults(updateVaultOptionInList(path, patch))
  }, [setExtraVaults])

  const setDefaultWorkspace = useCallback((path: string) => {
    setDefaultWorkspacePath(path)
    setExtraVaults(updateVaultOptionInList(path, { mounted: true }))
  }, [setDefaultWorkspacePath, setExtraVaults])

  return { setDefaultWorkspace, updateWorkspaceIdentity }
}
