import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'
import {
  buildCommandMenu,
  type CommandMenuEntry,
  type PrimeReportedCommand,
} from '../lib/primeCommandMenu'

function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  return isTauri() ? invoke<T>(command, args) : mockInvoke<T>(command, args)
}

const PROTOCOL_ONLY = buildCommandMenu([])

/**
 * Prime `get_commands`, filtered for the composer menu.
 *
 * Reloads when the host session changes. A failed fetch leaves the
 * protocol commands (fork, compact) so the menu still has a working set.
 */
export function usePrimeCommandMenu(enabled: boolean, sessionId: string | null): CommandMenuEntry[] {
  const [entries, setEntries] = useState<CommandMenuEntry[]>(PROTOCOL_ONLY)

  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    void call<PrimeReportedCommand[]>('get_prime_commands')
      .then((commands) => {
        if (!cancelled) setEntries(buildCommandMenu(commands))
      })
      .catch(() => {
        if (!cancelled) setEntries(PROTOCOL_ONLY)
      })

    return () => {
      cancelled = true
    }
  }, [enabled, sessionId])

  return enabled ? entries : PROTOCOL_ONLY
}
