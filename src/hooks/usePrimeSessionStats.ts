import { useCallback, useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'

/**
 * Token / cost / context-window snapshot for the live Prime session.
 *
 * Every field is optional because Prime omits them on a fresh session. A
 * missing value must stay unknown rather than rendering as zero — "0% of
 * context used" and "we don't know yet" are different claims, and the meter
 * must not show the second as the first.
 */
export interface PrimeSessionStats {
  sessionId?: string | null
  totalMessages?: number | null
  toolCalls?: number | null
  totalTokens?: number | null
  contextTokens?: number | null
  contextWindow?: number | null
  contextPercent?: number | null
  cost?: number | null
}

const EMPTY: PrimeSessionStats = {}

function call<T>(command: string): Promise<T> {
  return isTauri() ? invoke<T>(command) : mockInvoke<T>(command)
}

/** Compact token count: 669_500 -> "669.5k", 1_000_000 -> "1.0M". */
export function formatTokenCount(tokens: number | null | undefined): string | null {
  if (typeof tokens !== 'number' || !Number.isFinite(tokens) || tokens < 0) return null
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k`
  return String(Math.round(tokens))
}

/**
 * "669.5k / 1.0M (67%)" — null when we do not know enough to say anything
 * true. Requires both a usage figure and a window; a percentage with no
 * denominator is not worth rendering.
 */
export function formatContextUsage(stats: PrimeSessionStats): string | null {
  const used = formatTokenCount(stats.contextTokens)
  const total = formatTokenCount(stats.contextWindow)
  if (!used || !total) return null
  const percent = contextPercent(stats)
  return percent === null ? `${used} / ${total}` : `${used} / ${total} (${percent}%)`
}

/**
 * Whole-number percent of the context window in use, or null when unknown.
 * Prefers Prime's own `contextPercent` and falls back to computing it, so a
 * build that reports tokens but not percent still shows a bar.
 */
export function contextPercent(stats: PrimeSessionStats): number | null {
  const reported = stats.contextPercent
  if (typeof reported === 'number' && Number.isFinite(reported)) {
    return Math.max(0, Math.min(100, Math.round(reported)))
  }
  const { contextTokens: used, contextWindow: total } = stats
  if (typeof used !== 'number' || typeof total !== 'number' || total <= 0) return null
  return Math.max(0, Math.min(100, Math.round((used / total) * 100)))
}

/** Severity of context pressure, for colouring the bar. */
export function contextPressure(percent: number | null): 'ok' | 'warn' | 'high' | null {
  if (percent === null) return null
  if (percent >= 90) return 'high'
  if (percent >= 75) return 'warn'
  return 'ok'
}

/**
 * Poll the live Prime session's token/context stats.
 *
 * Deliberately slower than the host-status poll: this issues an RPC round-trip
 * to the agent process, and context usage moves at conversation speed, not UI
 * speed. Refreshes immediately when `refreshKey` changes so a finished turn
 * updates without waiting for the interval.
 */
export function usePrimeSessionStats(enabled = true, refreshKey?: unknown): PrimeSessionStats {
  const [stats, setStats] = useState<PrimeSessionStats>(EMPTY)

  const refresh = useCallback(() => {
    void call<PrimeSessionStats>('get_prime_session_stats')
      .then((next) => setStats(next ?? EMPTY))
      // No host, or Prime too old for the command — show nothing rather than
      // a stale meter from a previous session.
      .catch(() => setStats(EMPTY))
  }, [])

  useEffect(() => {
    if (!enabled) return
    refresh()
    const id = window.setInterval(refresh, 15_000)
    return () => window.clearInterval(id)
  }, [enabled, refresh, refreshKey])

  // Derived rather than cleared in the effect: setting state synchronously
  // there triggers a cascading render, and a disabled hook has nothing to
  // report regardless of what the last enabled run left behind.
  return enabled ? stats : EMPTY
}
