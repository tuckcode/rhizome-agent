import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'

export interface PrimeHostStatus {
  installed: boolean
  version: string | null
  running: boolean
  sessionId: string | null
  isStreaming: boolean
  binaryPath: string | null
  modelProvider?: string | null
  modelId?: string | null
  modelName?: string | null
}

const EMPTY: PrimeHostStatus = {
  installed: false,
  version: null,
  running: false,
  sessionId: null,
  isStreaming: false,
  binaryPath: null,
  modelProvider: null,
  modelId: null,
  modelName: null,
}

function call<T>(command: string): Promise<T> {
  return isTauri() ? invoke<T>(command) : mockInvoke<T>(command)
}

/**
 * Lightweight poll of the long-lived Prime RPC host status (model name, running).
 * Used for AI panel chrome — not a substitute for stream events.
 */
export function usePrimeHostStatus(enabled = true): PrimeHostStatus {
  const [status, setStatus] = useState<PrimeHostStatus>(EMPTY)

  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    const refresh = () => {
      void call<PrimeHostStatus>('get_prime_session_host_status')
        .then((next) => {
          if (!cancelled) setStatus(next)
        })
        .catch(() => {
          if (!cancelled) setStatus(EMPTY)
        })
    }

    refresh()
    const id = window.setInterval(refresh, 4000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [enabled])

  return status
}

export function primeModelLabel(status: PrimeHostStatus): string | null {
  const name = status.modelName?.trim() || status.modelId?.trim()
  return name || null
}
