import { useCallback, useEffect, useState } from 'react'
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
import { groupModelsByProvider, type PrimeModel } from '../lib/primeModels'
import { trackPrimeModelChanged } from '../lib/productAnalytics'
import { isTauri, mockInvoke } from '../mock-tauri'
import { invoke } from '@tauri-apps/api/core'

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri()) return invoke<T>(cmd, args)
  return mockInvoke<T>(cmd, args)
}

interface PrimeModelPickerProps {
  locale?: AppLocale
  /** Current model, as the host reports it. */
  label?: string | null
  disabled?: boolean
  side?: 'top' | 'bottom'
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
  disabled = false,
  side = 'top',
}: PrimeModelPickerProps) {
  const t = createTranslator(locale)
  const [open, setOpen] = useState(false)
  const [models, setModels] = useState<PrimeModel[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || models !== null) return
    let cancelled = false
    void (async () => {
      let listed: PrimeModel[] = []
      let failure: string | null = null
      try {
        listed = await call<PrimeModel[]>('get_available_prime_models')
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
  }, [open, models])

  // No success callback: `usePrimeHostStatus` polls the host, so the chip's
  // label follows the switch on its own within one interval.
  const select = useCallback(
    async (model: PrimeModel) => {
      try {
        await call('set_prime_model', { provider: model.provider, modelId: model.id })
        trackPrimeModelChanged(model.provider)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    },
    [],
  )

  const groups = groupModelsByProvider(models ?? [])

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button
          type="button"
          className={cn(
            'inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5',
            'font-mono text-[10.5px] text-muted-foreground transition-colors',
            'hover:border-border-strong hover:text-foreground',
            disabled && 'cursor-not-allowed opacity-60',
          )}
          aria-label={t('ai.composer.model')}
          data-testid="prime-model-chip"
        >
          <span className="max-w-[180px] truncate">{label ?? t('ai.composer.modelUnknown')}</span>
          <CaretDown size={9} weight="bold" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side={side} align="start" className="max-h-[320px] w-64 overflow-y-auto">
        {error ? (
          <div className="px-2 py-1.5 text-xs text-destructive" role="alert">
            {error}
          </div>
        ) : null}
        {models === null && !error ? (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            {t('ai.composer.modelsLoading')}
          </div>
        ) : null}
        {models !== null && !error && groups.length === 0 ? (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            {t('ai.composer.modelsEmpty')}
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
                className="text-[12.5px]"
              >
                <span className="truncate">{model.name}</span>
              </DropdownMenuItem>
            ))}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
