import { useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { isTauri } from '../mock-tauri'
import { cleanupTauriEventListener } from '../utils/tauriEventCleanup'

const INBOX_PROCESSED_EVENT = 'inbox-processed'
const INBOX_ERROR_EVENT = 'inbox-error'

interface InboxProcessedPayload {
  vaultPath: string
  artifactPath: string
}

interface InboxErrorPayload {
  vaultPath: string
  file: string
  error: string
}

function basename(path: string): string {
  const parts = path.split(/[\\/]/)
  return parts[parts.length - 1] || path
}

/** Alpha-3: when inbox automation is enabled for a wiki vault, start the
 *  Rust `raw/inbox/` watcher and toast on each processed/failed file. The
 *  per-vault enabled flag lives in `VaultConfig` (frontend-only), so it's
 *  passed to the Rust command as an argument rather than read Rust-side —
 *  mirroring how `start_vault_watcher` takes its path argument. */
export function useInboxWatcher(
  vaultPath: string,
  enabled: boolean,
  onToast: (message: string) => void,
): void {
  useEffect(() => {
    if (!enabled || !vaultPath.trim() || !isTauri()) return

    let cancelled = false
    let unlistenProcessed: UnlistenFn | null = null
    let unlistenError: UnlistenFn | null = null

    void listen<InboxProcessedPayload>(INBOX_PROCESSED_EVENT, (event) => {
      if (event.payload.vaultPath === vaultPath) {
        onToast(`Inbox: processed ${basename(event.payload.artifactPath)}`)
      }
    })
      .then((unlisten) => {
        if (cancelled) cleanupTauriEventListener(unlisten)
        else unlistenProcessed = unlisten
      })
      .catch((err) => console.warn('Failed to subscribe to inbox-processed:', err))

    void listen<InboxErrorPayload>(INBOX_ERROR_EVENT, (event) => {
      if (event.payload.vaultPath === vaultPath) {
        onToast(`Inbox: failed to process ${basename(event.payload.file)}`)
      }
    })
      .then((unlisten) => {
        if (cancelled) cleanupTauriEventListener(unlisten)
        else unlistenError = unlisten
      })
      .catch((err) => console.warn('Failed to subscribe to inbox-error:', err))

    void invoke('start_inbox_watcher', { vaultPath }).catch((err) => {
      console.warn('Failed to start inbox watcher:', err)
    })

    return () => {
      cancelled = true
      cleanupTauriEventListener(unlistenProcessed)
      cleanupTauriEventListener(unlistenError)
      void invoke('stop_inbox_watcher').catch(() => {})
    }
  }, [vaultPath, enabled, onToast])
}
