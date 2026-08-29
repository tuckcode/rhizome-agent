import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
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

/**
 * Prime's provider ids are lowercase slugs. A card headed "anthropic" beside
 * one headed "Prime Agent" looks like two different kinds of thing; these are
 * the names people actually use.
 */
const PROVIDER_LABELS: Record<string, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  openrouter: 'OpenRouter',
  opencode: 'OpenCode',
  'opencode-go': 'OpenCode Go',
  'prime-inference': 'Prime Inference',
  xai: 'xAI',
  google: 'Google',
}

function providerLabel(name: string): string {
  return PROVIDER_LABELS[name] ?? name
}

function authKindLabel(kind: string): string {
  if (kind === 'oauth') return 'OAuth'
  if (kind === 'api_key') return 'API key'
  // Prime resolves a key from the environment too, and a provider connected
  // that way used to have no card at all. Naming the source matters: it is
  // where you go to change it.
  if (kind === 'env') return 'Environment variable'
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
        // Cards, matching "Recognized local agents" directly above. These are
        // the same kind of fact — something this machine is connected to — and
        // showing one as a card and the other as a text list made the
        // connections read as an afterthought.
        <div className="grid gap-2 sm:grid-cols-2" data-testid="prime-provider-cards">
          {providers.map((provider) => (
            <div
              key={provider.name}
              className="rounded-md border border-border bg-background px-3 py-2"
              data-testid="prime-provider-row"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={cn(
                      'size-1.5 shrink-0 rounded-full',
                      provider.expired ? 'bg-destructive' : 'bg-[var(--accent-green)]',
                    )}
                  />
                  <div className="truncate text-sm font-medium text-foreground">
                    {providerLabel(provider.name)}
                  </div>
                </div>
                {provider.expired ? (
                  // An expired token fails every turn while still looking
                  // connected — the exact ambiguity this section exists to end.
                  <span
                    className="shrink-0 text-xs text-destructive"
                    data-testid="prime-provider-expired"
                  >
                    {t('settings.providers.expired')}
                  </span>
                ) : (
                  <span className="shrink-0 text-xs text-emerald-700">
                    {t('settings.providers.connected')}
                  </span>
                )}
              </div>
              <div className="mt-1 truncate text-xs text-muted-foreground">
                {authKindLabel(provider.authKind)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default PrimeProviderStatusSection
