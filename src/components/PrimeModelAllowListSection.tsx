import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { createTranslator } from '../lib/i18n'
import { filterModels, groupModelsByProvider, modelKey, type PrimeModel } from '../lib/primeModels'
import { loadPrimeModelCatalog, onPrimeModelCatalogReset } from '../lib/primeModelCatalog'
import { trackPrimeModelAllowListChanged } from '../lib/productAnalytics'
import { callHost } from '../lib/callHost'
import { Button } from './ui/button'
import { Input } from './ui/input'

/**
 * Choose which of Prime's models appear in the chat model menu (#45).
 *
 * Prime publishes its whole catalog — 501 models on one measured machine —
 * and exposes no price, so "show me only the free ones" cannot be a computed
 * filter. A hand-picked list is the mechanism that actually holds.
 *
 * The editor therefore must not be the same wall it is fixing: it opens on
 * the shortlist (or, when nothing is curated yet, on provider names — not
 * 501 checkboxes). Search still reaches every model. Checking a model keeps
 * it in Chat. Unchecking removes it from the Chat menu's first view.
 *
 * Writes land immediately, like archiving a session. A draft-and-Save cycle
 * over a list this long only adds a way to lose the work.
 */

type Translate = ReturnType<typeof createTranslator>

interface PrimeModelAllowListSectionProps {
  t: Translate
}

/**
 * How many search hits are rendered at once. A cap rather than a scroll of
 * hundreds — and it is stated in the UI, never silent: a truncated list that
 * looks complete is how "my model isn't there" starts.
 */
const MAX_VISIBLE_MATCHES = 40

export function PrimeModelAllowListSection({ t }: PrimeModelAllowListSectionProps) {
  const [models, setModels] = useState<PrimeModel[] | null>(null)
  const [allowList, setAllowList] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [providerFilter, setProviderFilter] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadCatalog = useCallback(async (cancelled: () => boolean) => {
    try {
      const listed = await loadPrimeModelCatalog()
      if (!cancelled()) setModels(listed)
    } catch {
      if (!cancelled()) setModels([])
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const listed = await callHost<string[]>('get_prime_model_allow_list')
        if (!cancelled) setAllowList(Array.isArray(listed) ? listed : [])
      } catch {
        if (!cancelled) setAllowList([])
      }
    })()
    const idle = window.setTimeout(() => {
      void loadCatalog(() => cancelled)
    }, 0)
    const stop = onPrimeModelCatalogReset(() => {
      void loadCatalog(() => cancelled)
    })
    return () => {
      cancelled = true
      window.clearTimeout(idle)
      stop()
    }
  }, [loadCatalog])

  const available = useMemo(() => models ?? [], [models])
  const selected = useMemo(() => new Set(allowList), [allowList])

  const persist = useCallback(
    async (next: string[]) => {
      const previous = allowList
      setAllowList(next)
      setError(null)
      try {
        await callHost('set_prime_model_allow_list', { models: next })
        trackPrimeModelAllowListChanged(next.length, available.length)
      } catch (e) {
        // Put the checkbox back rather than showing a state the file does
        // not have.
        setAllowList(previous)
        setError(e instanceof Error ? e.message : String(e))
      }
    },
    [allowList, available.length],
  )

  const toggle = useCallback(
    (model: PrimeModel) => {
      const key = modelKey(model)
      void persist(
        selected.has(key) ? allowList.filter((entry) => entry !== key) : [...allowList, key],
      )
    },
    [allowList, persist, selected],
  )

  const providers = useMemo(() => groupModelsByProvider(available).map((group) => group.provider), [available])
  const trimmedQuery = query.trim()
  const browsingProvider = !trimmedQuery && allowList.length === 0
  const matches = trimmedQuery
    ? filterModels(available, query)
    : browsingProvider && providerFilter
      ? available.filter((model) => model.provider === providerFilter)
      : available.filter((model) => selected.has(modelKey(model)))
  const groups = groupModelsByProvider(matches.slice(0, MAX_VISIBLE_MATCHES))
  const truncated = matches.length - Math.min(matches.length, MAX_VISIBLE_MATCHES)
  const showProviderBrowse = browsingProvider && !providerFilter

  return (
    <div className="flex flex-col gap-1.5" data-testid="prime-model-allow-list">
      <div className="text-[11px] font-medium text-foreground">
        Chat model menu
      </div>
      <p className="text-[11px] text-muted-foreground">
        Check models you want in Chat. Uncheck models you do not use. The first
        check starts a shortlist. Search or pick a provider to find the rest.
      </p>
      {models === null ? (
        <div className="text-[11px] text-muted-foreground">
          {t('settings.modelAllowList.loading')}
        </div>
      ) : available.length === 0 ? (
        <div className="text-[11px] text-muted-foreground" data-testid="model-allow-list-empty">
          {t('settings.modelAllowList.none')}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('settings.modelAllowList.filter', { count: String(available.length) })}
              aria-label={t('settings.modelAllowList.filter', { count: String(available.length) })}
              data-testid="model-allow-list-filter"
              className="h-8 text-[11px]"
            />
            {allowList.length > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-[11px]"
                onClick={() => void persist([])}
                data-testid="model-allow-list-clear"
              >
                {t('settings.modelAllowList.showAll')}
              </Button>
            ) : null}
          </div>

          {allowList.length === 0 ? (
            <div
              className="text-[11px] text-muted-foreground"
              data-testid="model-allow-list-uncurated"
            >
              {t('settings.modelAllowList.uncurated', { count: String(available.length) })}
            </div>
          ) : (
            <div className="text-[11px] text-muted-foreground">
              {t('settings.modelAllowList.summary', {
                selected: String(allowList.length),
                available: String(available.length),
              })}
            </div>
          )}

          {showProviderBrowse ? (
            <div className="flex flex-wrap gap-1.5" data-testid="model-allow-list-providers">
              {providers.map((provider) => (
                <Button
                  key={provider}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-[11px]"
                  data-testid={`model-allow-list-provider-${provider}`}
                  onClick={() => setProviderFilter(provider)}
                >
                  {provider}
                </Button>
              ))}
            </div>
          ) : null}

          {browsingProvider && providerFilter ? (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-[11px]"
                data-testid="model-allow-list-providers-back"
                onClick={() => setProviderFilter(null)}
              >
                All providers
              </Button>
              <span className="text-[11px] text-muted-foreground">{providerFilter}</span>
            </div>
          ) : null}

          {groups.length === 0 && trimmedQuery ? (
            <div
              className="text-[11px] text-muted-foreground"
              data-testid="model-allow-list-no-matches"
            >
              {t('settings.modelAllowList.noMatches')}
            </div>
          ) : null}

          {groups.length > 0 ? (
            <ul className="flex max-h-64 flex-col divide-y divide-border overflow-y-auto rounded-md border border-border">
              {groups.map((group) =>
                group.models.map((model) => {
                  const key = modelKey(model)
                  const checked = selected.has(key)
                  return (
                    <li key={key}>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={checked}
                        onClick={() => toggle(model)}
                        data-testid={`model-allow-list-item-${key}`}
                        className={cn(
                          'flex w-full items-center gap-2 px-2 py-1.5 text-left',
                          'text-[11px] text-foreground hover:bg-accent',
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            'flex size-3.5 shrink-0 items-center justify-center rounded-[3px] border',
                            checked
                              ? 'border-transparent bg-foreground text-background'
                              : 'border-border',
                          )}
                        >
                          {checked ? <Check size={10} weight="bold" /> : null}
                        </span>
                        <span className="truncate">{model.name || model.id}</span>
                        <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground">
                          {group.provider}
                        </span>
                      </button>
                    </li>
                  )
                }),
              )}
            </ul>
          ) : null}

          {/* Never a silent cap: a truncated list that looks complete is how
              "my model isn't there" starts. */}
          {truncated > 0 ? (
            <div className="text-[11px] text-muted-foreground" data-testid="model-allow-list-more">
              {t('settings.modelAllowList.more', {
                shown: String(MAX_VISIBLE_MATCHES),
                matched: String(matches.length),
              })}
            </div>
          ) : null}

          {error ? (
            <div className="text-[11px] text-destructive" role="alert">
              {error}
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
