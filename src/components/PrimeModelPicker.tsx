import { useCallback, useEffect, useState } from 'react'
import { callHost } from '../lib/callHost'
import { CaretDown } from '@phosphor-icons/react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { createTranslator, type AppLocale } from '../lib/i18n'
import {
  activeModelKey,
  filterModels,
  groupModelsByProvider,
  partitionModelsByAllowList,
  partitionModelsByConnection,
  type PrimeModel,
} from '../lib/primeModels'
import { modelThinkingLabel, thinkingLevelLabel } from '../lib/primeThinkingLevels'
import { loadPrimeModelCatalog } from '../lib/primeModelCatalog'
import { trackPrimeModelChanged, trackPrimeThinkingLevelChanged } from '../lib/productAnalytics'


const PROVIDER_LABEL_CLASS = 'font-mono text-[10px] uppercase tracking-[0.1em] text-primary'
const MUTED_SECTION_LABEL_CLASS = 'font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground'

interface PrimeModelPickerProps {
  locale?: AppLocale
  /** Current model, as the host reports it. */
  label?: string | null
  /** Current reasoning level, as the host reports it. */
  thinkingLevel?: string | null
  disabled?: boolean
  side?: 'top' | 'bottom'
  /** Vault the host should attach to. Required to spawn if nothing is running. */
  vaultPath?: string
  /** True when Chat already has a live Prime host. Skip a second ensure. */
  hostReady?: boolean
  /**
   * `strip` renders as inline instrumentation text for the telemetry strip;
   * `chip` is the original rounded composer chip. #9 moves this control to the
   * strip and removes the composer's copy, so `strip` is the live variant --
   * `chip` is kept because the component is still the one place model-fetching
   * lives, and a second copy of that logic is what #9 is trying to avoid.
   */
  variant?: 'chip' | 'strip'
}

/**
 * The composer's model chip.
 *
 * Rhizome Agent is bring-your-own-model: which model Prime happens to default
 * to is a property of the user's machine, so this picker is load-bearing
 * product surface rather than a convenience. The catalog is fetched once the
 * host is live, or when the menu opens — never on a cold mount that races
 * Prime's start and then remembers "not running".
 */
export function PrimeModelPicker({
  locale = 'en',
  label,
  thinkingLevel,
  disabled = false,
  side = 'top',
  vaultPath,
  hostReady = false,
  variant = 'chip',
}: PrimeModelPickerProps) {
  const t = createTranslator(locale)
  const [open, setOpen] = useState(false)
  const [models, setModels] = useState<PrimeModel[] | null>(null)
  const [levels, setLevels] = useState<string[]>([])
  const [connected, setConnected] = useState<string[]>([])
  const [allowList, setAllowList] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [showUnavailable, setShowUnavailable] = useState(false)
  const [showHidden, setShowHidden] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Chat starts the host. Prefetch once it is live so the menu is ready.
  // Opening without a live host still ensures, then loads. A failure is
  // not remembered — the host is often still starting.
  useEffect(() => {
    if (models !== null) return
    if (!hostReady && !open) return
    let cancelled = false
    void (async () => {
      let listed: PrimeModel[] = []
      let failure: string | null = null
      try {
        if (!hostReady && vaultPath) {
          await callHost('ensure_prime_session_host', { vaultPath })
        }
        const [catalog, providers, listedLevels] = await Promise.all([
          loadPrimeModelCatalog(),
          callHost<string[]>('get_connected_providers').catch(() => [] as string[]),
          callHost<string[]>('get_prime_thinking_levels').catch(() => [] as string[]),
        ])
        listed = catalog
        if (!cancelled) {
          setConnected(Array.isArray(providers) ? providers : [])
          setLevels(Array.isArray(listedLevels) ? listedLevels : [])
        }
      } catch (e) {
        failure = e instanceof Error ? e.message : String(e)
      }
      if (cancelled) return
      setError(failure)
      if (!failure) setModels(listed)
    })()
    return () => {
      cancelled = true
    }
  }, [open, models, vaultPath, hostReady])

  // Re-read on every open, unlike the catalog above, which is cached because
  // it is a daemon round-trip. The allow-list is a local settings read and it
  // is edited on a different surface — Settings — so caching it leaves this
  // menu showing a shortlist the user has already changed. Found by opening
  // the app, not by a test.
  //
  // A failure is a failure to read Rhizome's own file, and the answer to that
  // is the uncurated catalog: never a narrower menu than the user asked for.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    void (async () => {
      try {
        const listed = await callHost<string[]>('get_prime_model_allow_list')
        if (!cancelled) setAllowList(Array.isArray(listed) ? listed : [])
      } catch {
        if (!cancelled) setAllowList([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  // No success callback: `usePrimeHostStatus` polls the host, so the chip's
  // label follows the switch on its own within one interval.
  const select = useCallback(
    async (model: PrimeModel) => {
      try {
        if (vaultPath) {
          await callHost('ensure_prime_session_host', { vaultPath })
        }
        await callHost('set_prime_model', { provider: model.provider, modelId: model.id })
        trackPrimeModelChanged(model.provider)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    },
    [vaultPath],
  )

  const selectLevel = useCallback(
    async (level: string) => {
      try {
        if (vaultPath) {
          await callHost('ensure_prime_session_host', { vaultPath })
        }
        await callHost('set_prime_thinking_level', { level })
        trackPrimeThinkingLevelChanged(level)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    },
    [vaultPath],
  )

  const listed = models ?? []
  // Curation is applied to the whole catalog, before the query. Both of
  // `partitionModelsByAllowList`'s refusals are about the saved list going
  // stale against Prime's catalog, and judging that on a filtered subset would
  // read every narrow query as a stale list and silently drop the curation.
  // The query then narrows each bucket, so typing still reaches a hidden
  // model in one click.
  const { shown, hidden } = partitionModelsByAllowList(
    listed,
    allowList,
    activeModelKey(listed, label),
  )
  // Credentials second: the allow-list is the user's explicit choice, so a
  // model they filed away is counted there rather than again under
  // "not connected".
  const matchingHidden = filterModels(hidden, query)
  const { available, unavailable } = partitionModelsByConnection(
    filterModels(shown, query),
    connected,
  )
  const groups = groupModelsByProvider(available)
  const unavailableGroups = groupModelsByProvider(unavailable)
  const hiddenGroups = groupModelsByProvider(matchingHidden)
  const strip = variant === 'strip'
  const triggerLabel = strip
    ? (modelThinkingLabel(label, thinkingLevel) ?? t('ai.composer.modelUnknown'))
    : (label ?? t('ai.composer.modelUnknown'))

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button
          type="button"
          className={cn(
            'inline-flex items-center gap-1 transition-colors',
            strip
              ? 'min-w-0 rounded-sm px-1 py-0.5 font-mono text-[11px] font-medium text-foreground hover:bg-accent'
              : cn(
                  'rounded-full border border-border px-2 py-0.5',
                  'font-mono text-[11px] text-muted-foreground',
                  'hover:border-border-strong hover:text-foreground',
                ),
            disabled && 'cursor-not-allowed opacity-60',
          )}
          aria-label={strip ? t('ai.subhead.modelAndThinking') : t('ai.composer.model')}
          data-testid={strip ? 'prime-model-thinking-control' : 'prime-model-chip'}
        >
          <span className="max-w-[180px] truncate">{triggerLabel}</span>
          <CaretDown size={9} weight="bold" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side={side} align="start" className="max-h-[320px] w-64 overflow-y-auto">
        {error ? (
          <div className="px-2 py-1.5 text-xs text-destructive" role="alert">
            {error}
          </div>
        ) : null}
        {models !== null && !error ? (
          <div className="px-1.5 pb-1 pt-0.5">
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              // The menu treats typing as type-ahead navigation and would
              // swallow the query, so keystrokes stop here.
              onKeyDown={(event) => event.stopPropagation()}
              placeholder={t('ai.composer.modelsFilter')}
              className={cn(
                'w-full rounded-sm border border-border bg-background px-1.5 py-1',
                'font-mono text-[11px] text-foreground placeholder:text-muted-foreground',
                'focus:border-border-strong focus:outline-none',
              )}
              data-testid="prime-model-filter"
              aria-label={t('ai.composer.modelsFilter')}
            />
          </div>
        ) : null}
        {models === null && !error ? (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            {t('ai.composer.modelsLoading')}
          </div>
        ) : null}
        {models !== null && !error && groups.length === 0 && matchingHidden.length === 0 ? (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            {t('ai.composer.modelsEmpty')}
          </div>
        ) : null}
        {levels.length > 0 ? (
          <div data-testid="prime-thinking-levels">
            <DropdownMenuLabel className={MUTED_SECTION_LABEL_CLASS}>
              {t('ai.subhead.thinking')}
            </DropdownMenuLabel>
            {levels.map((level) => (
              <DropdownMenuItem
                key={level}
                onSelect={() => void selectLevel(level)}
                className="text-[12px]"
                data-testid={`prime-thinking-level-${level}`}
                data-selected={level === (thinkingLevel ?? '') ? 'true' : undefined}
              >
                <span className="truncate">{thinkingLevelLabel(level)}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </div>
        ) : null}
        {groups.map((group, index) => (
          <div key={group.provider}>
            {index > 0 ? <DropdownMenuSeparator /> : null}
            <DropdownMenuLabel className={PROVIDER_LABEL_CLASS} data-testid="prime-model-provider">
              {group.provider}
            </DropdownMenuLabel>
            {group.models.map((model) => (
              <DropdownMenuItem
                key={`${model.provider}/${model.id}`}
                onSelect={() => void select(model)}
                className="text-[12px]"
              >
                <span className="truncate">{model.name}</span>
              </DropdownMenuItem>
            ))}
          </div>
        ))}
        {/* Models whose provider has no credentials. Separated rather than
            hidden — "why can't I find X?" should stay answerable — and still
            selectable, because credential detection is best-effort and being
            wrong must not lock a user out of a model that works. */}
        {unavailable.length > 0 ? (
          <div data-testid="prime-models-unavailable">
            <DropdownMenuSeparator />
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault()
                setShowUnavailable((shown) => !shown)
              }}
              onKeyDown={(event) => event.stopPropagation()}
              className={cn(
                'w-full px-2 py-1.5 text-left font-mono text-[10px] uppercase',
                'tracking-[0.1em] text-muted-foreground hover:text-foreground',
              )}
              data-testid="prime-models-unavailable-toggle"
            >
              {t('ai.composer.modelsNotConnected', { count: String(unavailable.length) })}
            </button>
            {showUnavailable
              ? unavailableGroups.map((group) => (
                  <div key={`unavailable-${group.provider}`}>
                    <DropdownMenuLabel className={PROVIDER_LABEL_CLASS} data-testid="prime-model-provider">
                      {group.provider}
                    </DropdownMenuLabel>
                    {group.models.map((model) => (
                      <DropdownMenuItem
                        key={`unavailable-${model.provider}/${model.id}`}
                        onSelect={() => void select(model)}
                        className="text-[12px] opacity-60"
                      >
                        <span className="truncate">{model.name}</span>
                      </DropdownMenuItem>
                    ))}
                  </div>
                ))
              : null}
          </div>
        ) : null}
        {/* Models the user curated out of this menu (#45). Same shape as the
            block above and for the same reason: a shortlist is a default view,
            not a deletion, and the filter box still reaches through it. */}
        {matchingHidden.length > 0 ? (
          <div data-testid="prime-models-hidden">
            <DropdownMenuSeparator />
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault()
                setShowHidden((shown) => !shown)
              }}
              onKeyDown={(event) => event.stopPropagation()}
              className={cn(
                'w-full px-2 py-1.5 text-left font-mono text-[10px] uppercase',
                'tracking-[0.1em] text-muted-foreground hover:text-foreground',
              )}
              data-testid="prime-models-hidden-toggle"
            >
              {t('ai.composer.modelsHidden', { count: String(matchingHidden.length) })}
            </button>
            {showHidden
              ? hiddenGroups.map((group) => (
                  <div key={`hidden-${group.provider}`}>
                    <DropdownMenuLabel className={PROVIDER_LABEL_CLASS} data-testid="prime-model-provider">
                      {group.provider}
                    </DropdownMenuLabel>
                    {group.models.map((model) => (
                      <DropdownMenuItem
                        key={`hidden-${model.provider}/${model.id}`}
                        onSelect={() => void select(model)}
                        className="text-[12px] opacity-60"
                      >
                        <span className="truncate">{model.name}</span>
                      </DropdownMenuItem>
                    ))}
                  </div>
                ))
              : null}
          </div>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
