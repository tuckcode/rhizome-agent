import { useCallback, useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { createTranslator } from '../lib/i18n'
import { isTauri, mockInvoke } from '../mock-tauri'
import { invoke } from '@tauri-apps/api/core'
import { Button } from './ui/button'
import { writeClipboardText } from '../utils/clipboardText'

/**
 * Which model providers the engine is actually connected to.
 *
 * There was no surface for this at all, so "never connected" and "working"
 * looked identical — a user spent days treating a provider that had never been
 * signed into as a flaky model (#45). Reading the answer costs nothing and
 * removes a whole class of misdiagnosis.
 *
 * Prime owns the credential store (ADR-0168). Rhizome cannot finish OAuth from
 * here — Prime's daemon exposes no auth command — but it can show who is
 * connected and hand the user the one terminal command that starts sign-in.
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

/** OAuth providers users expect to connect from Settings. */
const OAUTH_SIGN_IN_PROVIDERS = ['anthropic', 'xai'] as const

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

function primeProviderLoginCommand(provider: string): string {
  return `prime-agent --provider ${provider}`
}

function mergeProviderCards(
  connected: ProviderStatus[],
): ProviderStatus[] {
  const byName = new Map(connected.map((provider) => [provider.name, provider]))
  for (const name of OAUTH_SIGN_IN_PROVIDERS) {
    if (!byName.has(name)) {
      byName.set(name, {
        name,
        authKind: 'oauth',
        expired: false,
      })
    }
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export function PrimeProviderStatusSection({ t }: PrimeProviderStatusSectionProps) {
  const [providers, setProviders] = useState<ProviderStatus[] | null>(null)
  const [signInNotice, setSignInNotice] = useState<string | null>(null)
  const [signInError, setSignInError] = useState<string | null>(null)

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

  const cards = useMemo(
    () => mergeProviderCards(providers ?? []),
    [providers],
  )

  const startSignIn = useCallback(async (provider: ProviderStatus) => {
    setSignInError(null)
    setSignInNotice(null)
    const command = primeProviderLoginCommand(provider.name)
    try {
      await writeClipboardText(command)
      setSignInNotice(
        t('settings.providers.signInCopied', {
          provider: providerLabel(provider.name),
          command,
        }),
      )
    } catch (error) {
      setSignInError(error instanceof Error ? error.message : String(error))
    }
  }, [t])

  const showSignIn = (provider: ProviderStatus): boolean => {
    if (provider.authKind !== 'oauth') return false
    const connected = providers?.some((entry) => entry.name === provider.name) ?? false
    return !connected || provider.expired
  }

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
      ) : cards.length === 0 ? (
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
          {cards.map((provider) => {
            const connected = providers.some((entry) => entry.name === provider.name)
            const signIn = showSignIn(provider)
            return (
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
                        connected && !provider.expired
                          ? 'bg-[var(--accent-green)]'
                          : 'bg-muted-foreground/50',
                      )}
                    />
                    <div className="truncate text-sm font-medium text-foreground">
                      {providerLabel(provider.name)}
                    </div>
                  </div>
                  {connected && provider.expired ? (
                    // An expired token fails every turn while still looking
                    // connected — the exact ambiguity this section exists to end.
                    <span
                      className="shrink-0 text-xs text-destructive"
                      data-testid="prime-provider-expired"
                    >
                      {t('settings.providers.expired')}
                    </span>
                  ) : connected ? (
                    <span className="shrink-0 text-xs text-feedback-success-text">
                      {t('settings.providers.connected')}
                    </span>
                  ) : (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {t('settings.providers.notConnected')}
                    </span>
                  )}
                </div>
                <div className="mt-1 truncate text-xs text-muted-foreground">
                  {authKindLabel(provider.authKind)}
                </div>
                {signIn ? (
                  <div className="mt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px]"
                      data-testid={`prime-provider-sign-in-${provider.name}`}
                      onClick={() => void startSignIn(provider)}
                    >
                      {provider.expired
                        ? t('settings.providers.reconnect')
                        : t('settings.providers.signIn')}
                    </Button>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
      {signInNotice ? (
        <p className="text-[11px] text-muted-foreground" data-testid="prime-provider-sign-in-notice">
          {signInNotice}
        </p>
      ) : null}
      {signInError ? (
        <p role="alert" className="text-[11px] text-destructive">
          {signInError}
        </p>
      ) : null}
    </div>
  )
}

export default PrimeProviderStatusSection
