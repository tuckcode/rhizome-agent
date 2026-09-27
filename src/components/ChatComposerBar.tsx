import type { ReactNode } from 'react'
import { CalendarDots, CaretDown, Target } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { trackComposerPillOpened } from '../lib/productAnalytics'
import { translate, type AppLocale } from '../lib/i18n'
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
  skillsLabel?: string | null
  onOpenGoal: () => void
  onOpenSchedule: () => void
  working?: boolean
  lastToolName?: string | null
  /** Shown in the status slot when a Prime worker failed to start. */
  failureReason?: string | null
  stats: PrimeSessionStats
}

function ComposerToolsMenu({
  locale,
  skillsLabel,
  onOpenGoal,
  onOpenSchedule,
}: Pick<ChatComposerBarProps, 'locale' | 'skillsLabel' | 'onOpenGoal' | 'onOpenSchedule'>) {
  return (
    <DropdownMenu onOpenChange={(open) => { if (open) trackComposerPillOpened('tools') }}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="font-mono text-[11px] text-muted-foreground"
          data-testid="composer-tools-menu"
        >
          Tools
          <CaretDown size={9} weight="bold" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-52">
        <DropdownMenuItem className="text-[12px]" onSelect={onOpenGoal} data-testid="prime-goal-trigger">
          <Target size={12} aria-hidden="true" />
          {translate(locale ?? 'en', 'ai.goal.trigger')}
        </DropdownMenuItem>
        <DropdownMenuItem className="text-[12px]" onSelect={onOpenSchedule} data-testid="prime-schedule-trigger">
          <CalendarDots size={12} aria-hidden="true" />
          {translate(locale ?? 'en', 'ai.schedule.trigger')}
        </DropdownMenuItem>
        {skillsLabel ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel
              className="font-mono text-[11px] font-normal text-muted-foreground"
              data-testid="composer-skills-pill"
            >
              Skills · {skillsLabel}
            </DropdownMenuLabel>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
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
          className={cn('shrink-0 font-mono text-[11px]', PRESSURE_TEXT_CLASS[pressure ?? 'ok'])}
          aria-label={`Context window ${usage}`}
          data-pressure={pressure ?? undefined}
          data-testid="prime-context-button"
        >
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
 * The one compact row under the Chat input (native audit 2026-09-26).
 *
 * Routine settings sit here together; Goal, Schedule and the skill go
 * behind Tools. Idle says nothing. A running turn and context pressure
 * are the only things that raise their voice.
 */
export function ChatComposerBar({
  locale = 'en',
  deck,
  skillsLabel,
  onOpenGoal,
  onOpenSchedule,
  working = false,
  lastToolName = null,
  failureReason = null,
  stats,
}: ChatComposerBarProps) {
  return (
    <div className="mt-1.5 flex min-w-0 items-center gap-1.5" data-testid="chat-composer-bar">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
        {deck}
        <ComposerToolsMenu
          locale={locale}
          skillsLabel={skillsLabel}
          onOpenGoal={onOpenGoal}
          onOpenSchedule={onOpenSchedule}
        />
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
