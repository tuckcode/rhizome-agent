import { useEffect, useState } from 'react'
import { createTranslator } from '../lib/i18n'
import { isTauri, mockInvoke } from '../mock-tauri'
import { invoke } from '@tauri-apps/api/core'

/**
 * Which model providers the engine is actually connected to.
 *
 * There was no surface for this at all, so "never connected" and "working"
 * looked identical — a user spent days treating a provider that had never been
 * signed into as a flaky model (#45). Reading the answer costs nothing and
 * removes a whole class of misdiagnosis.
 *
 * Read-only on purpose. Prime owns the credential store (ADR-0168) and its
 * daemon exposes no auth command across all 102, so connecting from here is a
 * separate decision, not a missing button. Nothing secret is fetched: the
 * backend returns provider name, auth kind and expiry only.
 */

interface ProviderStatus {
  name: string
  authKind: string
  expiresAt?: number
  expired: boolean
}

type Translate = ReturnType<typeof createTranslator>

interface PrimeProviderStatusSectionProps {
  t: Translate
}

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri()) return invoke<T>(cmd, args)
  return mockInvoke<T>(cmd, args)
}

function authKindLabel(kind: string): string {
  if (kind === 'oauth') return 'OAuth'
  if (kind === 'api_key') return 'API key'
  return kind
}

export function PrimeProviderStatusSection({ t }: PrimeProviderStatusSectionProps) {
  const [providers, setProviders] = useState<ProviderStatus[] | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const listed = await call<ProviderStatus[]>('get_prime_provider_status')
        if (!cancelled) setProviders(Array.isArray(listed) ? listed : [])
      } catch {
        if (!cancelled) setProviders([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="flex flex-col gap-1.5" data-testid="prime-provider-status">
      <div className="text-[11px] font-medium text-foreground">
        {t('settings.providers.title')}
      </div>
      <p className="text-[11px] text-muted-foreground">
        {t('settings.providers.description')}
      </p>
      {providers === null ? (
        <div className="text-[11px] text-muted-foreground">{t('settings.providers.loading')}</div>
      ) : providers.length === 0 ? (
        // Not an error: it also covers "the engine is not installed here".
        <div className="text-[11px] text-muted-foreground" data-testid="prime-provider-status-empty">
          {t('settings.providers.none')}
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
          {providers.map((provider) => (
            <li
              key={provider.name}
              className="flex items-center justify-between gap-2 px-2.5 py-1.5"
              data-testid="prime-provider-row"
            >
              <span className="min-w-0 truncate font-mono text-[11px] text-foreground">
                {provider.name}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {provider.expired ? (
                  // An expired token fails every turn while still looking
                  // connected — the exact ambiguity this section exists to end.
                  <span
                    className="font-mono text-[10px] uppercase tracking-[0.08em] text-destructive"
                    data-testid="prime-provider-expired"
                  >
                    {t('settings.providers.expired')}
                  </span>
                ) : null}
                <span className="font-mono text-[10px] text-muted-foreground">
                  {authKindLabel(provider.authKind)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default PrimeProviderStatusSection
