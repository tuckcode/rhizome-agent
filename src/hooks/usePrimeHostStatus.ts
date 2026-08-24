import { useEffect, useState } from 'react'
import { callHost } from '../lib/callHost'

/**
 * Why Prime is unreachable, when it is.
 *
 * A typed state rather than a message because each case has a different action
 * behind it — install, start, or update. Mirrors `PrimeConnectionProblem` in
 * `src-tauri/src/prime_session_host.rs`.
 */
export type PrimeConnectionProblem =
  | { code: 'not_installed' }
  | { code: 'service_unreachable'; detail?: string }
  | { code: 'service_too_old'; installedVersion?: string | null; requiredVersion: string }

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
  /**
   * Reasoning level the session is running at, when Prime reports one.
   * Same payload as the model, so the strip's combined control (#9) reads
   * both from one poll rather than two that can disagree mid-change.
   */
  thinkingLevel?: string | null
  /** True when the host rejoined a session that was already running (#7). */
  reattached?: boolean
  /** When the attached session started, ISO-8601. Uptime is derived from it. */
  startedAt?: string | null
  /** The attached session's log file, for rehydrating its transcript. */
  sessionPath?: string | null
  /** Why Prime is unreachable. Absent while connected. */
  problem?: PrimeConnectionProblem | null
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
  thinkingLevel: null,
  reattached: false,
  startedAt: null,
  sessionPath: null,
  problem: null,
}


/**
 * Lightweight poll of the long-lived Prime RPC host status (model name, running).
 * Used for AI panel chrome — not a substitute for stream events.
 */
export function usePrimeHostStatus(enabled = true, vaultPath?: string): PrimeHostStatus {
  const [status, setStatus] = useState<PrimeHostStatus>(EMPTY)

  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    const refresh = () => {
      void callHost<PrimeHostStatus>('get_prime_session_host_status')
        .then((next) => {
          if (!cancelled) setStatus(next)
        })
        .catch(() => {
          if (!cancelled) setStatus(EMPTY)
        })
    }

    const start = async () => {
      if (vaultPath) {
        try {
          await callHost('ensure_prime_session_host', { vaultPath })
        } catch {
          // Status poll still runs — chip shows not-running instead of hanging.
        }
      }
      if (!cancelled) refresh()
    }

    void start()
    const id = window.setInterval(refresh, 4000)
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || !vaultPath) return
      void start()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [enabled, vaultPath])

  return status
}

export function primeModelLabel(status: PrimeHostStatus): string | null {
  const name = status.modelName?.trim() || status.modelId?.trim()
  return name || null
}
