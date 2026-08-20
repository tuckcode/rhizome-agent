import { useEffect, useState } from 'react'
import { callHost } from '../lib/callHost'
import {
  buildCommandMenu,
  type CommandMenuEntry,
  type PrimeReportedCommand,
} from '../lib/primeCommandMenu'


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
    void callHost<PrimeReportedCommand[]>('get_prime_commands')
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
