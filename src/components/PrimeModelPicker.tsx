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
import { trackPrimeModelChanged, trackPrimeThinkingLevelChanged } from '../lib/productAnalytics'


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
 * product surface rather than a convenience. The list is fetched on open, not
 * on mount — there are ~78 models and most sessions never change one.
 */
export function PrimeModelPicker({
  locale = 'en',
  label,
  thinkingLevel,
  disabled = false,
  side = 'top',
  vaultPath,
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

  useEffect(() => {
    if (!open || models !== null) return
    let cancelled = false
    void (async () => {
      let listed: PrimeModel[] = []
      let failure: string | null = null
      try {
        if (vaultPath) {
          await callHost('ensure_prime_session_host', { vaultPath })
        }
        listed = await callHost<PrimeModel[]>('get_available_prime_models')
        // Which providers this account can actually reach. Best-effort: an
        // empty answer means "unknown", and the partition then shows
        // everything rather than greying out a model that works.
        try {
          const providers = await callHost<string[]>('get_connected_providers')
          if (!cancelled) setConnected(Array.isArray(providers) ? providers : [])
        } catch {
          if (!cancelled) setConnected([])
        }
        // The level list comes from the host too (#9: nothing hardcoded).
        // Its own failure must not blank the model list, which is the larger
        // half of this menu.
        try {
          const listedLevels = await callHost<string[]>('get_prime_thinking_levels')
          if (!cancelled) setLevels(Array.isArray(listedLevels) ? listedLevels : [])
        } catch {
          if (!cancelled) setLevels([])
        }
      } catch (e) {
        failure = e instanceof Error ? e.message : String(e)
      }
      if (cancelled) return
      setError(failure)
      setModels(listed)
    })()
    return () => {
      cancelled = true
    }
  }, [open, models, vaultPath])

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
            <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
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
            <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
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
                    <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
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
                    <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
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
