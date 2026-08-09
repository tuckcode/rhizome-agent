import { useCallback, useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri } from '../mock-tauri'
import { toActivityRows, type ActivityRow } from '../utils/menuBarActivity'

interface VaultEntry {
  label: string
  path: string
}

interface VaultListResult {
  vaults: VaultEntry[]
  active_vault: string | null
  default_workspace_path?: string | null
}

export interface MenuBarCompanionVault {
  /** Absolute path of the active vault, or null when none is set. */
  activeVaultPath: string | null
  /** Human label for the active vault, or null. */
  vaultLabel: string | null
  /** Newest few vault-activity rows for the network-activity feed. */
  activity: ActivityRow[]
  /** Re-fetch vault + activity (called when the popover is shown). */
  refresh: () => void
}

/**
 * Resolves the companion's vault context. The companion is a separate webview
 * with no vault state of its own, so it fetches the active vault from the same
 * `load_vault_list` command the main window uses, then reads that vault's
 * recent activity via the existing `rhizome_read_events` tool.
 */
export function useMenuBarCompanionVault(): MenuBarCompanionVault {
  const [activeVaultPath, setActiveVaultPath] = useState<string | null>(null)
  const [vaultLabel, setVaultLabel] = useState<string | null>(null)
  const [activity, setActivity] = useState<ActivityRow[]>([])

  const refresh = useCallback(() => {
    if (!isTauri()) return
    void (async () => {
      try {
        const list = (await invoke('load_vault_list')) as VaultListResult
        const active = list.active_vault ?? list.default_workspace_path ?? null
        setActiveVaultPath(active)
        setVaultLabel(list.vaults.find((v) => v.path === active)?.label ?? null)

        if (active) {
          const raw = (await invoke('call_rhizome_tool', {
            name: 'rhizome_read_events',
            args: { vaultPath: active },
          })) as string
          const events = JSON.parse(raw) as Array<Record<string, unknown>>
          setActivity(toActivityRows(events))
        } else {
          setActivity([])
        }
      } catch {
        // best-effort; leave prior state on failure
      }
    })()
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { activeVaultPath, vaultLabel, activity, refresh }
}
