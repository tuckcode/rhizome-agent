import { Target, Heartbeat, CalendarDots, Brain } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { createTranslator, type AppLocale } from '../lib/i18n'
import { ScheduledWorkPopover } from './ScheduledWorkPopover'
import { withHeartbeatFlag, type PrimeScheduledWork } from '../lib/primeScheduledWork'
import { usePrimeActivity } from './primeActivityContext'


/** Mirrors `PrimeAgentActivity` in `src-tauri/src/prime_agent_activity.rs`. */
export interface PrimeAgentActivity {
  goal?: {
    active: boolean
    status?: string
    objective?: string
    tokensUsed?: number
    remainingTokens?: number
    continuationsUsed?: number
  }
  heartbeats?: PrimeScheduledWork[]
  schedules?: PrimeScheduledWork[]
  thinkingLevel?: string
}


function Item({
  icon: Icon,
  children,
  emphasis = false,
}: {
  icon: typeof Target
  children: React.ReactNode
  emphasis?: boolean
}) {
  return (
    <span
      className={cn(
        'inline-flex min-w-0 shrink-0 items-center gap-1.5',
        emphasis ? 'text-[var(--accent-green)]' : 'text-muted-foreground',
      )}
    >
      <Icon size={11} weight={emphasis ? 'fill' : 'regular'} aria-hidden="true" />
      <span className="truncate">{children}</span>
    </span>
  )
}

/**
 * What the harness is doing besides answering the current message.
 *
 * Prime carries a persistent goal with a token budget, schedules its own
 * recurring re-entry, and runs at a chosen reasoning effort. Without this the
 * app renders a chatbot while a supervisor runs underneath.
 *
 * Renders nothing when there is nothing to say. An idle session with no goal
 * and no scheduled work should not get a band of zeroes — the band appearing
 * is itself the signal that something is running.
 */
export function AgentActivityBand({
  locale = 'en',
  enabled = true,
  now,
}: {
  locale?: AppLocale
  enabled?: boolean
  /** Test seam: skips the poll and renders this activity directly. */
  now?: PrimeAgentActivity
}) {
  const t = createTranslator(locale)
  const shared = usePrimeActivity()
  // `now` stays a test seam; otherwise the reading comes from the app-level
  // poll. This component used to own that poll, which quietly meant nothing
  // watched the harness unless the Chat destination was on screen.
  const activity = now ?? shared.activity
  const refresh = shared.refresh

  if (!enabled || !activity) return null

  const goal = activity.goal
  const heartbeats = activity.heartbeats ?? []
  const schedules = activity.schedules ?? []
  const goalActive = Boolean(goal?.active)
  const hasScheduled = heartbeats.length > 0 || schedules.length > 0

  // Nothing running: the band's absence is the honest report.
  if (!goalActive && !hasScheduled) return null

  return (
    <div
      className="flex min-h-[24px] shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-3 py-1 font-mono text-[10px] tracking-[0.02em]"
      data-testid="agent-activity-band"
    >
      {goalActive ? (
        <Item icon={Target} emphasis>
          {goal?.objective?.trim()
            ? t('ai.activity.goalWithObjective', { objective: goal.objective.trim() })
            : t('ai.activity.goal')}
          {typeof goal?.remainingTokens === 'number'
            ? ` · ${t('ai.activity.budgetLeft', {
                tokens: compactTokens(goal.remainingTokens),
              })}`
            : null}
        </Item>
      ) : null}

      {/* Counts alone could not be acted on. Each group now opens the list
          behind it so an individual entry can be paused or cancelled (#14). */}
      <ScheduledWorkPopover
        locale={locale}
        icon={Heartbeat}
        summary={
          t('ai.activity.heartbeats', { count: String(heartbeats.length) }) +
          (heartbeats[0]?.interval ? ` · ${heartbeats[0].interval}` : '')
        }
        items={withHeartbeatFlag(heartbeats)}
        onChanged={() => void refresh()}
      />

      <ScheduledWorkPopover
        locale={locale}
        icon={CalendarDots}
        summary={t('ai.activity.schedules', { count: String(schedules.length) })}
        items={withHeartbeatFlag(schedules)}
        onChanged={() => void refresh()}
      />

      {activity.thinkingLevel ? (
        <Item icon={Brain}>
          {t('ai.activity.thinking', { level: activity.thinkingLevel })}
        </Item>
      ) : null}
    </div>
  )
}

/** `120000` → `120k`. A budget is read at a glance, not audited. */
function compactTokens(tokens: number): string {
  if (tokens < 1000) return String(tokens)
  return `${Math.round(tokens / 100) / 10}k`
}
