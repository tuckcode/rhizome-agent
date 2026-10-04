import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { trackComposerPillOpened } from '../lib/productAnalytics'
import type { AppLocale } from '../lib/i18n'
import {
  contextPercent,
  contextPressure,
  formatContextUsage,
  type PrimeSessionStats,
} from '../hooks/usePrimeSessionStats'
import { ChatComposerFoot } from './ChatComposerFoot'
import { PrimeContextMeter } from './PrimeContextMeter'

const PRESSURE_TEXT_CLASS = {
  ok: 'text-muted-foreground',
  warn: 'text-[var(--accent-orange)]',
  high: 'text-[var(--accent-red)]',
} as const

interface ChatComposerBarProps {
  locale?: AppLocale
  /** Live turn controls from ChatHome: model, thinking, context note, active agents. */
  deck?: ReactNode
  working?: boolean
  lastToolName?: string | null
  /** Shown in the status slot when a Prime worker failed to start. */
  failureReason?: string | null
  stats: PrimeSessionStats
}

const PRESSURE_STROKE = {
  ok: 'var(--accent-blue)',
  warn: 'var(--accent-orange)',
  high: 'var(--accent-red)',
} as const

/** How full the window is, drawn as a ring beside the percent. */
function ContextRing({ percent, pressure }: { percent: number, pressure: 'ok' | 'warn' | 'high' | null }) {
  const radius = 7
  const circumference = 2 * Math.PI * radius
  const filled = (percent / 100) * circumference
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" data-testid="prime-context-ring">
      <circle cx="8" cy="8" r={radius} fill="none" stroke="var(--state-hover)" strokeWidth="2" />
      <circle
        cx="8"
        cy="8"
        r={radius}
        fill="none"
        stroke={pressure ? PRESSURE_STROKE[pressure] : 'var(--accent-blue)'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circumference - filled}`}
        transform="rotate(-90 8 8)"
      />
    </svg>
  )
}

/** Context usage as one short number; the full meter opens on request. */
function PrimeContextButton({ stats, locale }: { stats: PrimeSessionStats, locale?: AppLocale }) {
  const usage = formatContextUsage(stats)
  if (!usage) return null
  const percent = contextPercent(stats)
  const pressure = contextPressure(percent)
  return (
    <Popover onOpenChange={(open) => { if (open) trackComposerPillOpened('context_usage') }}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className={cn('shrink-0 gap-1 font-mono text-[11px]', PRESSURE_TEXT_CLASS[pressure ?? 'ok'])}
          aria-label={`Context window ${usage}`}
          data-pressure={pressure ?? undefined}
          data-testid="prime-context-button"
        >
          {percent !== null ? <ContextRing percent={percent} pressure={pressure} /> : null}
          {percent === null ? usage : `${percent}%`}
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="w-64">
        <PrimeContextMeter stats={stats} locale={locale} />
      </PopoverContent>
    </Popover>
  )
}

/**
 * The row under the Chat input.
 *
 * Model and thinking stay here. Goal, Schedule and skills live in the
 * plus menu. The context ring sits at the end, under the send control.
 */
export function ChatComposerBar({
  locale = 'en',
  deck,
  working = false,
  lastToolName = null,
  failureReason = null,
  stats,
}: ChatComposerBarProps) {
  return (
    <div className="mt-1.5 flex min-w-0 items-center gap-1.5" data-testid="chat-composer-bar">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
        {deck}
      </div>
      {(working || failureReason) ? (
        <ChatComposerFoot
          locale={locale}
          working={working}
          lastToolName={lastToolName}
          failureReason={failureReason}
        />
      ) : null}
      <PrimeContextButton stats={stats} locale={locale} />
    </div>
  )
}
