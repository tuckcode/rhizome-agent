import { createTranslator, type AppLocale } from '../lib/i18n'
import {
  contextPercent,
  contextPressure,
  formatContextUsage,
  formatTokenCount,
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
      <ContextBreakdown stats={stats} />
    </div>
  )
}

function formatCost(cost: number | null | undefined): string | null {
  if (typeof cost !== 'number' || !Number.isFinite(cost) || cost < 0) return null
  if (cost === 0) return '$0'
  if (cost < 0.01) return `$${cost.toFixed(4)}`
  return `$${cost.toFixed(2)}`
}

function freeTokens(stats: PrimeSessionStats): string | null {
  const used = stats.contextTokens
  const total = stats.contextWindow
  if (typeof used !== 'number' || typeof total !== 'number' || total < used) return null
  return formatTokenCount(total - used)
}

/** The figures Prime actually reports. A missing figure stays off the list. */
function ContextBreakdown({ stats }: { stats: PrimeSessionStats }) {
  const rows: Array<[string, string]> = []
  const free = freeTokens(stats)
  const used = formatTokenCount(stats.contextTokens)
  const window = formatTokenCount(stats.contextWindow)
  const total = formatTokenCount(stats.totalTokens)
  const cost = formatCost(stats.cost)
  if (used) rows.push(['Used', used])
  if (free) rows.push(['Free', free])
  if (window) rows.push(['Window', window])
  if (typeof stats.totalMessages === 'number') rows.push(['Messages', String(stats.totalMessages)])
  if (typeof stats.toolCalls === 'number') rows.push(['Tool calls', String(stats.toolCalls)])
  if (total) rows.push(['Tokens', total])
  if (cost) rows.push(['Cost', cost])
  if (rows.length === 0) return null
  return (
    <dl className="mt-1 flex flex-col gap-1" data-testid="prime-context-breakdown">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-baseline justify-between gap-3 font-mono text-[11px]">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="text-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  )
}
