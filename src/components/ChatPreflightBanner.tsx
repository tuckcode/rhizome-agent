import { useEffect, useState } from 'react'
import { Warning } from '@phosphor-icons/react'
import { createTranslator, type AppLocale } from '../lib/i18n'
import { isTauri, mockInvoke } from '../mock-tauri'
import { invoke } from '@tauri-apps/api/core'

/**
 * Say a turn will fail *before* the user sends it.
 *
 * Three unrelated failures used to reach the user as one sentence — "Prime
 * Agent finished without returning a reply". `ea21050` made the reactive half
 * honest by surfacing the provider's own error. This is the proactive half:
 * an unreadable vault (C53) or an unconnected provider (#45) is knowable
 * without spending a turn, so it is shown up front with the remedy attached.
 *
 * Deliberately silent unless something is actually blocking. A banner that
 * shows on a healthy setup is a banner people learn to scroll past, and the
 * backend refuses to guess for the same reason — an unreadable credential
 * store reports "unknown", never "not connected".
 */

interface CheckOk {
  status: 'ok'
}
interface CheckFailed {
  status: 'failed'
  reason: string
  remedy: string
}
type Check = CheckOk | CheckFailed

interface PreflightResult {
  vault: Check
  provider: Check
}

interface ChatPreflightBannerProps {
  locale?: AppLocale
  vaultPath?: string | null
  /** Provider of the currently selected model, e.g. `opencode`. */
  provider?: string | null
}

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri()) return invoke<T>(cmd, args)
  return mockInvoke<T>(cmd, args)
}

function isFailed(check: Check | undefined): check is CheckFailed {
  return check?.status === 'failed'
}

export function ChatPreflightBanner({
  locale = 'en',
  vaultPath = null,
  provider = null,
}: ChatPreflightBannerProps) {
  const t = createTranslator(locale)
  const [result, setResult] = useState<PreflightResult | null>(null)

  // Re-check when the vault or model changes: the failure this exists to catch
  // (C53) broke a setup that had been working, so a first-run-only check would
  // have reported "all good" and taught the user nothing.
  //
  // `cancelled` drops a result whose vault or model is already stale — switching
  // vaults quickly could otherwise land an older answer over a newer one and
  // accuse a healthy setup.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const next = await call<PreflightResult>('preflight_chat', {
          vaultPath: vaultPath ?? undefined,
          provider: provider ?? undefined,
        })
        if (!cancelled) setResult(next)
      } catch {
        // A preflight that cannot run must not become its own error banner.
        if (!cancelled) setResult(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [provider, vaultPath])

  // Vault first — an unreadable vault makes the provider question moot.
  const blockers = [result?.vault, result?.provider].filter(isFailed)
  if (blockers.length === 0) return null

  return (
    <div
      className="mb-1.5 flex min-w-0 items-start gap-2 rounded-md border border-border bg-muted px-3 py-2"
      data-testid="chat-preflight-banner"
      role="status"
    >
      <Warning size={14} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium text-foreground" data-testid="chat-preflight-title">
          {t('ai.preflight.title')}
        </div>
        <ul className="mt-0.5 flex flex-col gap-1">
          {blockers.map((blocker) => (
            <li key={blocker.reason} className="min-w-0 text-[11px] text-muted-foreground">
              <span className="text-foreground" data-testid="chat-preflight-reason">
                {blocker.reason}
              </span>
              {' — '}
              <span data-testid="chat-preflight-remedy">{blocker.remedy}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default ChatPreflightBanner
