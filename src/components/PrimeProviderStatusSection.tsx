import { useCallback, useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { createTranslator } from '../lib/i18n'
import { callHost } from '../lib/callHost'
import { resetPrimeModelCatalog } from '../lib/primeModelCatalog'
import { trackNousPortalAddedToChat, trackPrimeProviderSignIn } from '../lib/productAnalytics'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { writeClipboardText } from '../utils/clipboardText'
import { openExternalUrl } from '../utils/url'

/**
 * Which model providers the engine is actually connected to.
 *
 * There was no surface for this at all, so "never connected" and "working"
 * looked identical — a user spent days treating a provider that had never been
 * signed into as a flaky model (#45). Reading the answer costs nothing and
 * removes a whole class of misdiagnosis.
 *
 * Prime owns the credential store (ADR-0168). Sign in runs Prime's own login
 * code through a helper (ADR-0176): OAuth providers open the browser, and
 * key providers open their key page and take the pasted key here.
 *
 * Prime Inference is the model backend: one API key, OpenAI-compatible, for
 * Claude, Grok, DeepSeek, Qwen, and the rest. Per-provider OAuth stays
 * available, and it is not the path we lead with.
 *
 * API-key hosts and custom OpenAI-compatible hosts (Nous Portal) use the same
 * Terminal handoff for keys: copy a command, never write Prime's auth.json
 * from the desktop. Nous models themselves are merged into
 * Prime's `models.json` when the user clicks Add to Chat list.
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

/** Always-visible cards so missing/expired providers are not invisible. */
const ALWAYS_SHOW_PROVIDERS: ReadonlyArray<{ name: string; authKind: string }> = [
  { name: 'prime-inference', authKind: 'api_key' },
  { name: 'anthropic', authKind: 'oauth' },
  { name: 'openai-codex', authKind: 'oauth' },
  // Browser sign-in comes from the user's `xai-oauth.ts` Prime extension,
  // not Prime itself; without it Sign in says so.
  { name: 'xai', authKind: 'oauth' },
  { name: 'deepseek', authKind: 'api_key' },
  { name: 'nous-portal', authKind: 'api_key' },
]

/** Where each key provider hands out API keys. Sign in opens this page. */
const KEY_PAGES: Record<string, string> = {
  deepseek: 'https://platform.deepseek.com/api_keys',
}

interface KeyEntry {
  provider: string
  value: string
}

interface EnsureNousPortalResult {
  provider: string
  modelCount: number
  reloaded: boolean
}

/**
 * Prime's provider ids are lowercase slugs. A card headed "anthropic" beside
 * one headed "Prime Agent" looks like two different kinds of thing; these are
 * the names people actually use.
 */
const PROVIDER_LABELS: Record<string, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  'openai-codex': 'ChatGPT (Codex)',
  openrouter: 'OpenRouter',
  opencode: 'OpenCode',
  'opencode-go': 'OpenCode Go',
  'prime-inference': 'Prime Inference',
  xai: 'xAI (Grok)',
  google: 'Google',
  deepseek: 'DeepSeek',
  'nous-portal': 'Nous Portal',
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
  if (provider === 'nous-portal') {
    // The Chat list is filled by `ensure_nous_portal_models`. This one-liner
    // is only the key Prime still reads from the environment.
    return "export NOUS_API_KEY='paste-your-key-here'"
  }
  return `prime-agent --provider ${provider}`
}

function setupButtonLabel(provider: ProviderStatus, connected: boolean): string {
  if (provider.authKind === 'oauth') {
    return connected || provider.expired ? 'Reconnect' : 'Sign in'
  }
  if (provider.name === 'nous-portal') return 'Add to Chat list'
  return 'Add key'
}

function mergeProviderCards(
  connected: ProviderStatus[],
): ProviderStatus[] {
  const byName = new Map(connected.map((provider) => [provider.name, provider]))
  for (const placeholder of ALWAYS_SHOW_PROVIDERS) {
    if (!byName.has(placeholder.name)) {
      byName.set(placeholder.name, {
        name: placeholder.name,
        authKind: placeholder.authKind,
        expired: false,
      })
    }
  }
  return [...byName.values()].sort((a, b) => {
    if (a.name === 'prime-inference') return -1
    if (b.name === 'prime-inference') return 1
    return a.name.localeCompare(b.name)
  })
}

export function PrimeProviderStatusSection({ t }: PrimeProviderStatusSectionProps) {
  const [providers, setProviders] = useState<ProviderStatus[] | null>(null)
  const [signInNotice, setSignInNotice] = useState<string | null>(null)
  const [signInError, setSignInError] = useState<string | null>(null)
  const [nousBusy, setNousBusy] = useState(false)
  const [busyProvider, setBusyProvider] = useState<string | null>(null)
  const [keyEntry, setKeyEntry] = useState<KeyEntry | null>(null)

  const loadProviders = useCallback(async (): Promise<ProviderStatus[]> => {
    try {
      const listed = await callHost<ProviderStatus[]>('get_prime_provider_status')
      return Array.isArray(listed) ? listed : []
    } catch {
      return []
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void loadProviders().then((listed) => {
      if (!cancelled) setProviders(listed)
    })
    return () => {
      cancelled = true
    }
  }, [loadProviders])

  // After a credential lands: re-read the cards and drop the cached model list,
  // so Chat's picker asks Prime again and sees the new provider's models.
  const refreshAfterSignIn = useCallback(async () => {
    resetPrimeModelCatalog()
    setProviders(await loadProviders())
  }, [loadProviders])

  const signInWithBrowser = useCallback(async (provider: ProviderStatus) => {
    const label = providerLabel(provider.name)
    setBusyProvider(provider.name)
    setSignInNotice(`Finish signing in to ${label} in your browser.`)
    try {
      await callHost('sign_in_prime_provider', { provider: provider.name })
      await refreshAfterSignIn()
      trackPrimeProviderSignIn(provider.name, 'browser', 'success')
      setSignInNotice(`Signed in to ${label}.`)
    } catch (error) {
      trackPrimeProviderSignIn(provider.name, 'browser', 'failed')
      setSignInNotice(null)
      setSignInError(error instanceof Error ? error.message : String(error))
    } finally {
      setBusyProvider(null)
    }
  }, [refreshAfterSignIn])

  const saveKey = useCallback(async () => {
    if (!keyEntry) return
    const { provider, value } = keyEntry
    setSignInError(null)
    setBusyProvider(provider)
    try {
      await callHost('save_prime_provider_key', { provider, key: value })
      await refreshAfterSignIn()
      trackPrimeProviderSignIn(provider, 'api_key', 'success')
      setKeyEntry(null)
      setSignInNotice(`Saved the ${providerLabel(provider)} key.`)
    } catch (error) {
      trackPrimeProviderSignIn(provider, 'api_key', 'failed')
      setSignInError(error instanceof Error ? error.message : String(error))
    } finally {
      setBusyProvider(null)
    }
  }, [keyEntry, refreshAfterSignIn])

  const cards = useMemo(
    () => mergeProviderCards(providers ?? []),
    [providers],
  )

  const startSignIn = useCallback(async (provider: ProviderStatus) => {
    setSignInError(null)
    setSignInNotice(null)
    if (provider.name === 'nous-portal') {
      setNousBusy(true)
      try {
        const result = await callHost<EnsureNousPortalResult>('ensure_nous_portal_models')
        resetPrimeModelCatalog()
        trackNousPortalAddedToChat(result.modelCount)
        const count = result.modelCount
        const modelsWord = count === 1 ? 'model' : 'models'
        setSignInNotice(
          `Added ${count} Nous Portal ${modelsWord} to the Chat list. Check the ones you want in Chat model menu below. Set NOUS_API_KEY if Chat greys them out.`,
        )
      } catch (error) {
        setSignInError(error instanceof Error ? error.message : String(error))
      } finally {
        setNousBusy(false)
      }
      return
    }
    if (provider.authKind === 'oauth') {
      await signInWithBrowser(provider)
      return
    }
    const keyPage = KEY_PAGES[provider.name]
    if (keyPage) {
      setKeyEntry({ provider: provider.name, value: '' })
      setSignInNotice(`Create a key on the ${providerLabel(provider.name)} page that opened, then paste it here.`)
      await openExternalUrl(keyPage)
      return
    }
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
  }, [t, signInWithBrowser])

  const copyNousKeyCommand = useCallback(async () => {
    setSignInError(null)
    try {
      await writeClipboardText(primeProviderLoginCommand('nous-portal'))
      setSignInNotice('Copied the NOUS_API_KEY line. Paste it in Terminal, then Add to Chat list.')
    } catch (error) {
      setSignInError(error instanceof Error ? error.message : String(error))
    }
  }, [])

  const showSetup = (provider: ProviderStatus): boolean => {
    const connected = providers?.some((entry) => entry.name === provider.name) ?? false
    if (provider.name === 'nous-portal') {
      // A key in the environment used to mark the card Connected while Chat
      // still had no Nous models. Keep the add button even after the key is
      // present so the catalog can be filled or refreshed.
      return true
    }
    if (provider.authKind === 'oauth') {
      return !connected || provider.expired
    }
    // API-key / custom: offer setup until Prime reports the provider.
    return !connected
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
            const setup = showSetup(provider)
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
                <div className="mt-1 text-xs text-muted-foreground">
                  {provider.name === 'prime-inference'
                    ? 'One API key. Claude, Grok, DeepSeek, Qwen, and more.'
                    : authKindLabel(provider.authKind)}
                </div>
                {setup ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px]"
                      data-testid={`prime-provider-sign-in-${provider.name}`}
                      disabled={(provider.name === 'nous-portal' && nousBusy) || busyProvider !== null}
                      onClick={() => void startSignIn(provider)}
                    >
                      {provider.name === 'nous-portal' && nousBusy
                        ? 'Adding…'
                        : busyProvider === provider.name && provider.authKind === 'oauth'
                          ? 'Waiting for browser…'
                          : setupButtonLabel(provider, connected)}
                    </Button>
                    {provider.name === 'nous-portal' ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-[11px]"
                        data-testid="prime-provider-copy-nous-key"
                        onClick={() => void copyNousKeyCommand()}
                      >
                        Copy key command
                      </Button>
                    ) : null}
                  </div>
                ) : null}
                {keyEntry?.provider === provider.name ? (
                  <form
                    className="mt-2 flex gap-1.5"
                    onSubmit={(event) => {
                      event.preventDefault()
                      void saveKey()
                    }}
                  >
                    <Input
                      type="password"
                      autoFocus
                      autoComplete="off"
                      placeholder="Paste API key"
                      aria-label={`${providerLabel(provider.name)} API key`}
                      className="h-7 text-[11px]"
                      data-testid={`prime-provider-key-input-${provider.name}`}
                      value={keyEntry.value}
                      onChange={(event) => setKeyEntry({ provider: provider.name, value: event.target.value })}
                    />
                    <Button
                      type="submit"
                      size="sm"
                      className="h-7 text-[11px]"
                      data-testid={`prime-provider-key-save-${provider.name}`}
                      disabled={!keyEntry.value.trim() || busyProvider !== null}
                    >
                      Save
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-[11px]"
                      onClick={() => setKeyEntry(null)}
                    >
                      Cancel
                    </Button>
                  </form>
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
