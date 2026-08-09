import { useCallback, type Dispatch, type SetStateAction } from 'react'
import type { VaultOption } from '../components/status-bar/types'
import { trackEvent } from '../lib/telemetry'
import { orderVaultsByPath } from '../utils/vaultOrdering'

function persistableVault(vault: VaultOption): VaultOption {
  const persistedVault = { ...vault }
  delete persistedVault.managedDefault
  return persistedVault
}

export function useVaultReorderAction({
  allVaults,
  setExtraVaults,
}: {
  allVaults: VaultOption[]
  setExtraVaults: Dispatch<SetStateAction<VaultOption[]>>
}) {
  return useCallback((orderedPaths: string[]) => {
    const orderedVaults = orderVaultsByPath(allVaults, orderedPaths)
    if (!orderedVaults) return

    setExtraVaults(orderedVaults.map(persistableVault))
    trackEvent('vault_order_changed', { vault_count: orderedVaults.length })
  }, [allVaults, setExtraVaults])
}
