import { createTranslator, type AppLocale } from '../lib/i18n'
import {
  contextPercent,
  contextPressure,
  formatContextUsage,
  type PrimeSessionStats,
} from '../hooks/usePrimeSessionStats'

const PRESSURE_BAR_CLASS = {
  ok: 'bg-[var(--accent-blue)]',
  warn: 'bg-[var(--accent-orange)]',
  high: 'bg-[var(--accent-red)]',
} as const

/**
 * Context-window usage for the live Prime session.
 *
 * Renders nothing unless we know both the usage and the window — a bar with no
 * denominator would imply a certainty we do not have, and a fresh session
 * legitimately reports neither.
 */
export function PrimeContextMeter({
  stats,
  locale = 'en',
}: {
  stats: PrimeSessionStats
  locale?: AppLocale
}) {
  const usage = formatContextUsage(stats)
  if (!usage) return null

  const percent = contextPercent(stats)
  const pressure = contextPressure(percent)
  const t = createTranslator(locale)

  return (
    <div className="flex flex-col gap-1" data-testid="prime-context-meter">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono-overline uppercase text-muted-foreground">
          {t('ai.panel.contextWindow')}
        </span>
        <span
          className="font-mono text-[10px] text-muted-foreground"
          data-testid="prime-context-usage"
        >
          {usage}
        </span>
      </div>
      {percent !== null && (
        <div
          className="h-1 w-full overflow-hidden rounded-full bg-[var(--state-hover)]"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t('ai.panel.contextWindow')}
        >
          <div
            className={`h-full rounded-full transition-all ${pressure ? PRESSURE_BAR_CLASS[pressure] : ''}`}
            style={{ width: `${percent}%` }}
            data-testid="prime-context-bar"
            data-pressure={pressure ?? undefined}
          />
        </div>
      )}
    </div>
  )
}
