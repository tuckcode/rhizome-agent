import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'

export type ClaudeCodeStatus = 'checking' | 'installed' | 'missing'

interface ClaudeCliResult {
  installed: boolean
  version: string | null
}

function tauriCall<T>(command: string): Promise<T> {
  return isTauri() ? invoke<T>(command) : mockInvoke<T>(command)
}

/**
 * Checks once on mount whether the `claude` CLI binary is available.
 * Returns a status suitable for the status bar badge.
 */
export function useClaudeCodeStatus(): { status: ClaudeCodeStatus; version: string | null } {
  const [status, setStatus] = useState<ClaudeCodeStatus>('checking')
  const [version, setVersion] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    tauriCall<ClaudeCliResult>('check_claude_cli')
      .then((result) => {
        if (cancelled) return
        setStatus(result.installed ? 'installed' : 'missing')
        setVersion(result.version ?? null)
      })
      .catch(() => {
        if (!cancelled) setStatus('missing')
      })

    return () => { cancelled = true }
  }, [])

  return { status, version }
}
