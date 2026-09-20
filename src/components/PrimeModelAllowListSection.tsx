import { useCallback, useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { createTranslator } from '../lib/i18n'
import {
  filterModels,
  groupModelsByProvider,
  modelKey,
  partitionModelsByFree,
  providerSelectionState,
  type PrimeModel,
} from '../lib/primeModels'
import { loadPrimeModelCatalog, onPrimeModelCatalogReset } from '../lib/primeModelCatalog'
import { trackPrimeModelAllowListChanged, trackPrimeModelsFreeOnly } from '../lib/productAnalytics'
import { callHost } from '../lib/callHost'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Switch } from './ui/switch'
import { Checkbox } from './ui/checkbox'
import { usePrimeModelsFreeOnly } from '../hooks/usePrimeModelsFreeOnly'

/**
 * Choose which of Prime's models appear in the chat model menu (#45).
 *
 * Prime publishes its whole catalog — 501 models on one measured machine.
 * Free only is a second cut on that catalog: an explicit host flag, then
 * provider-marked suffixes. The hand-picked list is still the shortlist.
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
  const [freeOnly, setFreeOnly] = usePrimeModelsFreeOnly()
  const [editingList, setEditingList] = useState(false)
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
  const catalog = useMemo(() => partitionModelsByFree(available, freeOnly).shown, [available, freeOnly])
  const selected = useMemo(() => new Set(allowList), [allowList])
  const effectiveSelection = useMemo(
    () => new Set(allowList.length > 0 ? allowList : available.map(modelKey)),
    [allowList, available],
  )

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
      if (editingList) {
        const next = new Set(effectiveSelection)
        if (next.has(key)) next.delete(key)
        else next.add(key)
        void persist([...next])
        return
      }
      void persist(
        selected.has(key) ? allowList.filter((entry) => entry !== key) : [...allowList, key],
      )
    },
    [allowList, editingList, effectiveSelection, persist, selected],
  )

  const toggleProvider = useCallback(
    (modelsForProvider: PrimeModel[]) => {
      const keys = modelsForProvider.map(modelKey)
      const shouldSelect = keys.some((key) => !effectiveSelection.has(key))
      const next = new Set(effectiveSelection)
      for (const key of keys) {
        if (shouldSelect) next.add(key)
        else next.delete(key)
      }
      void persist([...next])
    },
    [effectiveSelection, persist],
  )

  const providers = useMemo(() => groupModelsByProvider(catalog).map((group) => group.provider), [catalog])
  const trimmedQuery = query.trim()
  const browsingProvider = !editingList && !trimmedQuery && allowList.length === 0
  const matches = trimmedQuery
    ? filterModels(catalog, query)
    : editingList
      ? catalog
    : browsingProvider && providerFilter
      ? catalog.filter((model) => model.provider === providerFilter)
      : catalog.filter((model) => selected.has(modelKey(model)))
  const visibleMatches = editingList ? matches : matches.slice(0, MAX_VISIBLE_MATCHES)
  const groups = groupModelsByProvider(visibleMatches)
  const selectedInCatalog = catalog.filter((model) => selected.has(modelKey(model))).length
  const truncated = editingList ? 0 : matches.length - Math.min(matches.length, MAX_VISIBLE_MATCHES)
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
              placeholder={t('settings.modelAllowList.filter', { count: String(catalog.length) })}
              aria-label={t('settings.modelAllowList.filter', { count: String(catalog.length) })}
              data-testid="model-allow-list-filter"
              className="h-8 text-[11px]"
            />
            <div className="flex shrink-0 items-center gap-1.5">
              <span className="text-[11px] text-foreground">Free only</span>
              <Switch
                checked={freeOnly}
                aria-label="Free only"
                data-testid="model-allow-list-free-only"
                onCheckedChange={(on) => {
                  setFreeOnly(on)
                  trackPrimeModelsFreeOnly(on)
                  setProviderFilter(null)
                }}
              />
            </div>
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
            <Button
              type="button"
              variant={editingList ? 'secondary' : 'outline'}
              size="sm"
              className="h-8 text-[11px]"
              onClick={() => {
                setEditingList((editing) => !editing)
                setProviderFilter(null)
              }}
              data-testid="model-allow-list-edit-toggle"
            >
              {editingList ? 'Done' : 'Edit list'}
            </Button>
          </div>

          {allowList.length === 0 ? (
            <div
              className="text-[11px] text-muted-foreground"
              data-testid="model-allow-list-uncurated"
            >
              {t('settings.modelAllowList.uncurated', { count: String(catalog.length) })}
            </div>
          ) : (
            <div className="text-[11px] text-muted-foreground">
              {t('settings.modelAllowList.summary', {
                selected: String(selectedInCatalog),
                available: String(catalog.length),
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

          {groups.length === 0 && (trimmedQuery || (freeOnly && catalog.length === 0)) ? (
            <div
              className="text-[11px] text-muted-foreground"
              data-testid={
                freeOnly && catalog.length === 0
                  ? 'model-allow-list-no-free'
                  : 'model-allow-list-no-matches'
              }
            >
              {freeOnly && catalog.length === 0
                ? 'No free models in this catalog.'
                : t('settings.modelAllowList.noMatches')}
            </div>
          ) : null}

          {groups.length > 0 ? (
            <ul
              data-testid="model-allow-list-rows"
              data-editing={editingList ? 'true' : undefined}
              className={cn(
                'flex flex-col divide-y divide-border rounded-md border border-border',
                editingList ? undefined : 'max-h-64 overflow-y-auto',
              )}
            >
              {groups.map((group) => {
                const providerModels = catalog.filter((model) => model.provider === group.provider)
                return [
                  editingList ? (
                    <li key={`provider-${group.provider}`}>
                      <label className="flex w-full cursor-pointer items-center gap-2 bg-muted/40 px-2 py-2 text-left text-[11px] font-medium">
                        <Checkbox
                          checked={providerSelectionState(providerModels, effectiveSelection)}
                          data-testid={`model-allow-list-group-${group.provider}`}
                          onCheckedChange={() => {
                            toggleProvider(providerModels)
                          }}
                        />
                        <span>{group.provider}</span>
                      </label>
                    </li>
                  ) : null,
                  ...group.models.map((model) => {
                    const key = modelKey(model)
                    const checked = editingList ? effectiveSelection.has(key) : selected.has(key)
                    return (
                      <li key={key}>
                        <label
                          className={cn(
                            'flex w-full cursor-pointer items-center gap-2 px-2 text-left',
                            'text-[11px] text-foreground hover:bg-accent',
                            editingList ? 'py-2' : 'py-1.5',
                          )}
                        >
                          <Checkbox
                            checked={checked}
                            data-testid={`model-allow-list-item-${key}`}
                            onCheckedChange={() => toggle(model)}
                          />
                          <span className="truncate">{model.name || model.id}</span>
                          {editingList ? null : (
                            <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground">
                              {group.provider}
                            </span>
                          )}
                        </label>
                      </li>
                    )
                  }),
                ]
              })}
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
