import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { createTranslator, type AppLocale } from '../lib/i18n'
import {
  primeSessionAge,
  primeSessionMetaLabel,
  primeSessionRowTitles,
  sortPrimeSessions,
  type PrimeSessionSummary,
} from '../lib/primeSessionMeta'
import { trackPrimeSessionListOpened, trackPrimeSessionOpened } from '../lib/productAnalytics'
import { isTauri, mockInvoke } from '../mock-tauri'
import { invoke } from '@tauri-apps/api/core'

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri()) return invoke<T>(cmd, args)
  return mockInvoke<T>(cmd, args)
}

interface PrimeSessionListProps {
  locale?: AppLocale
  /** Chosen session. The caller switches and rehydrates — this list only picks. */
  onSelectSession?: (session: PrimeSessionSummary) => void
  onNewChat?: () => void
  /** Path the live host is on, so that row can read as current. */
  activeSessionPath?: string | null
  /** True while the live session is mid-turn — drives the working dot. */
  working?: boolean
  /** Overridable so tests do not depend on the wall clock. */
  now?: number
}

/**
 * One session row — Frame F's `session-item`.
 *
 * A 6px status dot, then title over a mono meta line. The dot is outlined
 * normally and filled only while that session is working, so a glance answers
 * "is anything running" without reading a word.
 */
function SessionRow({
  label,
  title,
  meta,
  active,
  working,
  onSelect,
}: {
  label: string
  title: string
  meta: string | null
  active: boolean
  working: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={label}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'grid w-full grid-cols-[6px_1fr] items-start gap-2 rounded-sm border border-transparent',
        'px-2 py-[9px] text-left transition-colors hover:border-border hover:bg-background',
        active && 'border-border-strong bg-background',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'mt-[5px] size-1.5 rounded-full border',
          working
            ? 'border-[var(--accent-green)] bg-[var(--accent-green)] ring-2 ring-[var(--accent-green)]/25'
            : 'border-muted-foreground/50 bg-transparent',
        )}
      />
      <span className="min-w-0">
        <span className="block truncate text-[12.5px] leading-[1.35] text-foreground">{title}</span>
        {meta ? (
          <span className="mt-[3px] block truncate font-mono text-[10px] tracking-[0.02em] text-muted-foreground">
            {meta}
          </span>
        ) : null}
      </span>
    </button>
  )
}

/**
 * Past Prime sessions, newest first.
 *
 * Reads summaries only — opening this never reads a 2 MB log. The transcript
 * is loaded by whoever handles the selection.
 */
export default function PrimeSessionList({
  locale = 'en',
  onSelectSession,
  onNewChat,
  activeSessionPath = null,
  working = false,
  now,
}: PrimeSessionListProps) {
  const t = createTranslator(locale)
  const [sessions, setSessions] = useState<PrimeSessionSummary[] | null>(null)
  // Captured when the data is read, not at render: the label should describe
  // the moment the list was true, and reading a clock in a memo is impure.
  const [loadedAt, setLoadedAt] = useState(() => Date.now())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      // Awaits before touching state so the effect never cascades a render.
      let listed: PrimeSessionSummary[] = []
      let failure: string | null = null
      try {
        const answer = await call<PrimeSessionSummary[]>('list_prime_session_summaries')
        // Not every host answers with a list: a mock with no handler for this
        // command, a Tauri build where it is absent, or a command that returns
        // null all reach here. Trusting the type threw inside the effect,
        // which surfaces as an unhandled rejection instead of an empty list
        // the panel can render.
        listed = Array.isArray(answer) ? answer : []
      } catch (e) {
        failure = e instanceof Error ? e.message : String(e)
      }
      if (cancelled) return
      setError(failure)
      setLoadedAt(Date.now())
      setSessions(listed)
      trackPrimeSessionListOpened(listed.length)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const ordered = useMemo(() => sortPrimeSessions(sessions ?? []), [sessions])
  const at = now ?? loadedAt
  const untitled = t('ai.sessions.untitled')
  // Computed across the whole list rather than per row: whether a title needs
  // disambiguating is a property of its neighbours, not of the session. Left
  // to the React Compiler rather than a `useMemo` — `untitled` comes from
  // `t()`, a fresh value every render, so a hand-written memo cannot hold.
  const titles = primeSessionRowTitles(ordered, untitled)

  const select = useCallback(
    (session: PrimeSessionSummary) => {
      trackPrimeSessionOpened(primeSessionAge(session, at))
      onSelectSession?.(session)
    },
    [at, onSelectSession],
  )

  return (
    <div className="flex h-full w-full min-w-0 flex-col" data-testid="prime-session-list">
      <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-border px-2.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
          {t('ai.sessions.title')}
        </span>
        {onNewChat ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="h-6 w-6 p-0"
            onClick={onNewChat}
            aria-label={t('ai.sessions.newChat')}
            title={t('ai.sessions.newChat')}
          >
            <Plus size={14} />
          </Button>
        ) : null}
      </div>

      {error ? (
        <p className="px-2.5 py-3 text-xs text-destructive" role="alert">
          {t('ai.sessions.error', { message: error })}
        </p>
      ) : null}

      {sessions !== null && !error && ordered.length === 0 ? (
        <p className="px-2.5 py-3 text-xs text-muted-foreground">{t('ai.sessions.empty')}</p>
      ) : null}

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-0.5 p-1.5">
          {ordered.map((session, index) => {
            const title = titles[index] ?? untitled
            const active = Boolean(activeSessionPath) && session.path === activeSessionPath
            const isWorking = active && working
            return (
              <SessionRow
                key={session.id}
                title={title}
                meta={primeSessionMetaLabel(session, at, { working: isWorking })}
                label={t('ai.sessions.selectAria', { title })}
                active={active}
                working={isWorking}
                onSelect={() => select(session)}
              />
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}
