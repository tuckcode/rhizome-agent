import { useCallback, useState } from 'react'
import { callHost } from '../lib/callHost'
import { CaretDown, Pause, Play, X } from '@phosphor-icons/react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { createTranslator, type AppLocale } from '../lib/i18n'
import { trackPrimeScheduledWorkAction } from '../lib/productAnalytics'
import { scheduledWorkNextRun, type PrimeScheduledWork } from '../lib/primeScheduledWork'


/**
 * The list behind a band entry: every scheduled prompt, individually, with the
 * controls #14 asks for.
 *
 * The band itself is a one-line strip — it can say "2 heartbeats" but has no
 * room to name them or act on them. Putting the detail in a popover keeps the
 * strip quiet while making each entry reachable in one click.
 *
 * **Pause is offered only for heartbeats.** Probed against prime-agent 0.7.4:
 * the daemon has `heartbeat_manage` (pause/resume/stop) but no `cron_pause`, so
 * a plain schedule can only be cancelled. Rendering a pause button that the
 * backend cannot honour would be worse than not offering it.
 */
export function ScheduledWorkPopover({
  locale = 'en',
  icon: Icon,
  summary,
  items,
  onChanged,
}: {
  locale?: AppLocale
  icon: React.ComponentType<{ size?: number; weight?: 'regular' | 'fill'; 'aria-hidden'?: boolean }>
  /** The one-line label the band shows when closed. */
  summary: string
  items: PrimeScheduledWork[]
  /** Re-read after a mutation so the list reflects it immediately (#14). */
  onChanged: () => void
}) {
  const t = createTranslator(locale)
  const [open, setOpen] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const act = useCallback(
    async (item: PrimeScheduledWork, action: 'pause' | 'resume' | 'cancel') => {
      if (!item.id) return
      setBusyId(item.id)
      setError(null)
      try {
        if (action === 'cancel') {
          await callHost('cancel_prime_scheduled_work', { jobId: item.id })
        } else {
          await callHost('manage_prime_heartbeat', { jobId: item.id, action })
        }
        trackPrimeScheduledWorkAction(action, item.source ?? 'unknown')
        onChanged()
      } catch (e) {
        // Surfaced rather than swallowed: a control whose row does not change
        // reads as broken, which is exactly the confusion #9 just fixed.
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setBusyId(null)
      }
    },
    [onChanged],
  )

  if (items.length === 0) return null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid="scheduled-work-trigger"
          className={cn(
            'inline-flex min-w-0 shrink-0 items-center gap-1.5 rounded-sm px-1 py-0.5',
            'text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
          )}
        >
          <Icon size={11} aria-hidden={true} />
          <span className="truncate">{summary}</span>
          <CaretDown size={8} weight="bold" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0 text-[12px]">
        {error ? (
          <div className="px-3 py-2 text-[11.5px] text-destructive" role="alert">
            {error}
          </div>
        ) : null}
        <ul className="flex max-h-[280px] flex-col overflow-y-auto py-1">
          {items.map((item, index) => {
            const paused = item.status === 'paused'
            const busy = busyId === item.id
            const nextRun = scheduledWorkNextRun(item)
            return (
              <li
                key={item.id ?? index}
                data-testid="scheduled-work-row"
                data-status={item.status ?? 'unknown'}
                className="flex items-start gap-2 border-b border-border/60 px-3 py-2 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-foreground">
                    {item.label?.trim() || t('ai.activity.scheduled.untitled')}
                  </div>
                  <div className="truncate font-mono text-[11px] text-muted-foreground">
                    {[item.interval, nextRun, paused ? t('ai.activity.scheduled.paused') : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </div>

                {/* Pause only where the daemon can honour it — heartbeats. */}
                {item.isHeartbeat && item.id ? (
                  <button
                    type="button"
                    disabled={busy}
                    data-testid="scheduled-work-pause"
                    aria-label={
                      paused ? t('ai.activity.scheduled.resume') : t('ai.activity.scheduled.pause')
                    }
                    title={
                      paused ? t('ai.activity.scheduled.resume') : t('ai.activity.scheduled.pause')
                    }
                    className="shrink-0 rounded-sm p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
                    onClick={() => void act(item, paused ? 'resume' : 'pause')}
                  >
                    {paused ? <Play size={12} /> : <Pause size={12} />}
                  </button>
                ) : null}

                {item.id ? (
                  <button
                    type="button"
                    disabled={busy}
                    data-testid="scheduled-work-cancel"
                    aria-label={t('ai.activity.scheduled.cancel')}
                    title={t('ai.activity.scheduled.cancel')}
                    className="shrink-0 rounded-sm p-1 text-muted-foreground hover:bg-accent hover:text-destructive disabled:opacity-50"
                    onClick={() => void act(item, 'cancel')}
                  >
                    <X size={12} />
                  </button>
                ) : null}
              </li>
            )
          })}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
