/**
 * Paths that `reload_vault` may write as side effects (today: AGENTS.md refresh).
 * Watcher feedback on these paths causes a redundant "Reloading vault..." flash
 * unless the frontend marks them as internal writes before the invoke.
 */
export function managedVaultReloadWritePaths(vaultPath: string): string[] {
  const normalized = vaultPath.replaceAll('\\', '/').replace(/\/+$/u, '')
  if (!normalized.trim()) return []
  return [`${normalized}/AGENTS.md`]
}

type PathMarker = (path: string) => void

let pathMarker: PathMarker | null = null

/** Register the active app-owned write marker (from useRecentVaultWrites). */
export function setManagedVaultReloadWriteMarker(marker: PathMarker | null): void {
  pathMarker = marker
}

/**
 * Suppress vault-watcher reloads for managed files that `reload_vault` may
 * rewrite (AGENTS.md). Safe no-op when no marker is registered (tests/mock).
 */
export function suppressManagedVaultReloadWatcherFeedback(vaultPath: string): void {
  if (!pathMarker) return
  for (const path of managedVaultReloadWritePaths(vaultPath)) {
    pathMarker(path)
  }
}
