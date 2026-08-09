import { useEffect, useState } from 'react'
import { checkIsWikiVault } from './vaultLoaderCommands'

/** Is `vaultPath` a dedicated Rhizome wiki vault (vs. personal notes)?
 *  Drives the sidebar's Projects-vs-Types/Folders nav mode (Alpha-2).
 *  Kept as its own small hook rather than threaded through useVaultLoader's
 *  larger state machine — this is a one-shot, vault-path-keyed check with
 *  no interaction with entries/folders loading. */
export function useIsWikiVault(vaultPath: string): boolean {
  const [isWikiVault, setIsWikiVault] = useState(false)

  useEffect(() => {
    let cancelled = false
    const check = vaultPath.trim() ? checkIsWikiVault({ vaultPath }) : Promise.resolve(false)
    check.then((result) => {
      if (!cancelled) setIsWikiVault(result)
    })
    return () => {
      cancelled = true
    }
  }, [vaultPath])

  return isWikiVault
}
