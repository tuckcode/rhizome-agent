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

type Listener = (status: PrimeHostStatus) => void

type HostLoop = {
  listeners: Set<Listener>
  lastProblemCode: string | null
  intervalId: number
  onVisible: () => void
}

const loops = new Map<string, HostLoop>()

function windowIsVisible(): boolean {
  return document.visibilityState === 'visible'
}

function withCorroboratedProblem(
  next: PrimeHostStatus,
  lastProblemCode: string | null,
): { status: PrimeHostStatus; lastProblemCode: string | null } {
  const code = next.problem?.code ?? null
  const corroborated = code !== null && code === lastProblemCode
  return {
    lastProblemCode: code,
    status: corroborated || code === null ? next : { ...next, problem: null },
  }
}

function publish(loop: HostLoop, status: PrimeHostStatus): void {
  for (const listener of loop.listeners) listener(status)
}

async function tick(vaultPath: string, loop: HostLoop): Promise<void> {
  if (!windowIsVisible()) return

  if (vaultPath) {
    try {
      await callHost('ensure_prime_session_host', { vaultPath })
    } catch {
      // Status poll still runs — chip shows not-running instead of hanging.
    }
  }

  try {
    let next = await callHost<PrimeHostStatus>('get_prime_session_host_status')
    // A test build often loses the first connect: the window is up before
    // Prime's service is listening. Polling status alone then freezes the
    // chip on "Model" for the rest of the session. If we are down and we
    // have a vault, try again — a refused socket is cheap.
    if (!next.running && vaultPath) {
      try {
        await callHost('ensure_prime_session_host', { vaultPath })
      } catch {
        // Same as the first connect — the next status read still paints.
      }
      next = await callHost<PrimeHostStatus>('get_prime_session_host_status')
    }
    const published = withCorroboratedProblem(next, loop.lastProblemCode)
    loop.lastProblemCode = published.lastProblemCode
    publish(loop, published.status)
  } catch {
    loop.lastProblemCode = null
    publish(loop, EMPTY)
  }
}

function subscribe(vaultPath: string, listener: Listener): () => void {
  let loop = loops.get(vaultPath)
  if (!loop) {
    loop = {
      listeners: new Set(),
      lastProblemCode: null,
      intervalId: 0,
      onVisible: () => undefined,
    }
    loop.onVisible = () => {
      const active = loops.get(vaultPath)
      if (!active || document.visibilityState !== 'visible') return
      void tick(vaultPath, active)
    }
    document.addEventListener('visibilitychange', loop.onVisible)
    loop.intervalId = window.setInterval(() => {
      const active = loops.get(vaultPath)
      if (active) void tick(vaultPath, active)
    }, 4000)
    loops.set(vaultPath, loop)
    void tick(vaultPath, loop)
  }
  loop.listeners.add(listener)
  return () => {
    loop.listeners.delete(listener)
    if (loop.listeners.size > 0) return
    window.clearInterval(loop.intervalId)
    document.removeEventListener('visibilitychange', loop.onVisible)
    loops.delete(vaultPath)
  }
}

/** Drop shared polls. Tests call this so one case cannot leak into the next. */
export function resetPrimeHostStatus(): void {
  for (const [vaultPath, loop] of loops) {
    window.clearInterval(loop.intervalId)
    document.removeEventListener('visibilitychange', loop.onVisible)
    loops.delete(vaultPath)
  }
}

/**
 * Lightweight poll of the long-lived Prime RPC host status (model name, running).
 * Chat, the update badge, and the model chip all need this. One loop per vault,
 * not one loop per widget — three overlapping ensure calls were the Chat hitch.
 */
export function usePrimeHostStatus(enabled = true, vaultPath?: string): PrimeHostStatus {
  const [status, setStatus] = useState<PrimeHostStatus>(EMPTY)

  useEffect(() => {
    if (!enabled) return
    return subscribe(vaultPath ?? '', setStatus)
  }, [enabled, vaultPath])

  return enabled ? status : EMPTY
}

export function primeModelLabel(status: PrimeHostStatus): string | null {
  const name = status.modelName?.trim() || status.modelId?.trim()
  return name || null
}
