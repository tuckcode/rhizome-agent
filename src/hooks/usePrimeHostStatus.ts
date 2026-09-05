import { useEffect, useRef, useState, type MutableRefObject } from 'react'
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
  /**
   * Whether the running model takes images, from `get_state`'s Model.
   * `undefined`/`null` means Prime did not say — not "text only".
   */
  modelAcceptsImages?: boolean | null
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
  modelAcceptsImages: null,
  modelName: null,
  thinkingLevel: null,
  reattached: false,
  startedAt: null,
  sessionPath: null,
  problem: null,
}


/**
 * Hold a problem back until a second poll agrees with it.
 *
 * At launch the window is up before Prime's service is listening, so the first
 * status can answer `not_installed` for an engine that is merely still
 * starting. Rendering that immediately tells the user to go install software
 * that is already there, seconds before the strip corrects itself to live
 * (C64). A problem is only real once it survives one more poll.
 */
function withCorroboratedProblem(
  next: PrimeHostStatus,
  lastProblemCode: MutableRefObject<string | null>,
): PrimeHostStatus {
  const code = next.problem?.code ?? null
  const corroborated = code !== null && code === lastProblemCode.current
  lastProblemCode.current = code
  return corroborated || code === null ? next : { ...next, problem: null }
}

/**
 * Lightweight poll of the long-lived Prime RPC host status (model name, running).
 * Used for AI panel chrome — not a substitute for stream events.
 */
export function usePrimeHostStatus(enabled = true, vaultPath?: string): PrimeHostStatus {
  const [status, setStatus] = useState<PrimeHostStatus>(EMPTY)
  const lastProblemCode = useRef<string | null>(null)

  useEffect(() => {
    if (!enabled) return

    let cancelled = false

    const connect = async () => {
      if (!vaultPath) return
      try {
        await callHost('ensure_prime_session_host', { vaultPath })
      } catch {
        // Status poll still runs — chip shows not-running instead of hanging.
      }
    }

    const refresh = async () => {
      try {
        let next = await callHost<PrimeHostStatus>('get_prime_session_host_status')
        // A test build often loses the first connect: the window is up before
        // Prime's service is listening. Polling status alone then freezes the
        // chip on "Model" for the rest of the session. If we are down and we
        // have a vault, try again — a refused socket is cheap.
        if (!next.running && vaultPath) {
          await connect()
          next = await callHost<PrimeHostStatus>('get_prime_session_host_status')
        }
        if (!cancelled) setStatus(withCorroboratedProblem(next, lastProblemCode))
      } catch {
        if (!cancelled) {
          lastProblemCode.current = null
          setStatus(EMPTY)
        }
      }
    }

    void (async () => {
      await connect()
      if (!cancelled) await refresh()
    })()
    const id = window.setInterval(() => {
      void refresh()
    }, 4000)
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || !vaultPath) return
      void (async () => {
        await connect()
        if (!cancelled) await refresh()
      })()
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
