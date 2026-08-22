import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Archive, ArrowCounterClockwise, CaretRight, Plus } from '@phosphor-icons/react'
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
import {
  trackPrimeSessionArchived,
  trackPrimeSessionListOpened,
  trackPrimeSessionOpened,
} from '../lib/productAnalytics'
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
  /**
   * The vault this list was opened from. Rows that ran somewhere else say so;
   * rows from here stay quiet, because naming the open vault on every row is
   * noise. Absent means no comparison, so every row names its place.
   */
  vaultPath?: string | null
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
function SessionRowFrame({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <div
      className={cn(
        'group relative flex items-stretch rounded-sm border border-transparent',
        'transition-colors hover:border-border hover:bg-background',
        active && 'border-border-strong bg-background',
      )}
    >
      {children}
    </div>
  )
}

/**
 * The trailing icon action on a row — archive, or restore.
 *
 * Hidden until the row is hovered or the button itself is focused, so a list
 * at rest is titles and nothing else. `focus-visible` is not optional here:
 * an action that only appears on hover is an action a keyboard cannot reach.
 */
function SessionRowAction({
  label,
  icon,
  onClick,
}: {
  label: string
  icon: ReactNode
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        'absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2 p-0 opacity-0 transition-opacity',
        'group-hover:opacity-100 focus-visible:opacity-100',
      )}
    >
      {icon}
    </Button>
  )
}

function SessionRowButton({
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
        'grid w-full grid-cols-[6px_1fr] items-start gap-2 rounded-sm',
        'px-2 py-[9px] pr-8 text-left',
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
 * A session in the main list. Its action files it away.
 *
 * An explicit variant rather than `<SessionRow archived={false} …>`: the row
 * already carries `active` and `working`, and a third boolean plus two
 * handlers would make one component answer for eight states. Each variant
 * composes the same frame and button and differs only in its one action,
 * which is the whole of the difference.
 */
function LiveSessionRow({
  label,
  title,
  meta,
  active,
  working,
  onSelect,
  archiveLabel,
  onArchive,
}: {
  label: string
  title: string
  meta: string | null
  active: boolean
  working: boolean
  onSelect: () => void
  archiveLabel: string
  onArchive: () => void
}) {
  return (
    <SessionRowFrame active={active}>
      <SessionRowButton
        label={label}
        title={title}
        meta={meta}
        active={active}
        working={working}
        onSelect={onSelect}
      />
      <SessionRowAction label={archiveLabel} icon={<Archive size={13} />} onClick={onArchive} />
    </SessionRowFrame>
  )
}

/** A filed session. Same row, and its action puts it back. */
function ArchivedSessionRow({
  label,
  title,
  meta,
  active,
  onSelect,
  restoreLabel,
  onRestore,
}: {
  label: string
  title: string
  meta: string | null
  active: boolean
  onSelect: () => void
  restoreLabel: string
  onRestore: () => void
}) {
  return (
    <SessionRowFrame active={active}>
      <SessionRowButton
        label={label}
        title={title}
        meta={meta}
        active={active}
        // An archived session is not the one being watched: it was filed out
        // of the way. Nothing to indicate.
        working={false}
        onSelect={onSelect}
      />
      <SessionRowAction
        label={restoreLabel}
        icon={<ArrowCounterClockwise size={13} />}
        onClick={onRestore}
      />
    </SessionRowFrame>
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
  vaultPath = null,
  now,
}: PrimeSessionListProps) {
  const t = createTranslator(locale)
  const [sessions, setSessions] = useState<PrimeSessionSummary[] | null>(null)
  // Captured when the data is read, not at render: the label should describe
  // the moment the list was true, and reading a clock in a memo is impure.
  const [loadedAt, setLoadedAt] = useState(() => Date.now())
  const [error, setError] = useState<string | null>(null)
  const [archiveOpen, setArchiveOpen] = useState(false)

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
  //
  // Across *both* sections, not each on its own: a session keeps the label it
  // had when it is filed, so archiving a row does not rename its neighbour.
  const titles = primeSessionRowTitles(ordered, untitled)
  const titleFor = new Map(ordered.map((session, index) => [session.id, titles[index] ?? untitled]))
  const live = ordered.filter((session) => !session.archived)
  const archived = ordered.filter((session) => session.archived)

  const select = useCallback(
    (session: PrimeSessionSummary) => {
      trackPrimeSessionOpened(primeSessionAge(session, at))
      onSelectSession?.(session)
    },
    [at, onSelectSession],
  )

  /**
   * File a session away, or put it back.
   *
   * Moves the row first and tells the host after. Archiving is a view over
   * Rhizome's own settings — nothing on disk changes and nothing can be lost —
   * so waiting on a round trip to redraw would be latency spent for no safety.
   * A failure puts the row back and says why.
   */
  const setArchived = useCallback(
    (session: PrimeSessionSummary, next: boolean) => {
      setSessions((current) =>
        (current ?? []).map((entry) =>
          entry.id === session.id ? { ...entry, archived: next } : entry,
        ),
      )
      trackPrimeSessionArchived(next)
      void call('set_prime_session_archived', { sessionId: session.id, archived: next }).catch(
        (e: unknown) => {
          setSessions((current) =>
            (current ?? []).map((entry) =>
              entry.id === session.id ? { ...entry, archived: !next } : entry,
            ),
          )
          setError(e instanceof Error ? e.message : String(e))
        },
      )
    },
    [],
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
          {live.map((session) => {
            const title = titleFor.get(session.id) ?? untitled
            const active = Boolean(activeSessionPath) && session.path === activeSessionPath
            const isWorking = active && working
            return (
              <LiveSessionRow
                key={session.id}
                title={title}
                meta={primeSessionMetaLabel(session, at, { working: isWorking, vaultPath })}
                label={t('ai.sessions.selectAria', { title })}
                active={active}
                working={isWorking}
                onSelect={() => select(session)}
                archiveLabel={t('ai.sessions.archive', { title })}
                onArchive={() => setArchived(session, true)}
              />
            )
          })}

          {archived.length > 0 ? (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setArchiveOpen((open) => !open)}
                aria-expanded={archiveOpen}
                className={cn(
                  'mt-1 h-7 justify-start gap-1 px-2 font-mono text-[10px] uppercase',
                  'tracking-[0.1em] text-muted-foreground',
                )}
              >
                <CaretRight
                  size={10}
                  aria-hidden="true"
                  className={cn('transition-transform', archiveOpen && 'rotate-90')}
                />
                {t('ai.sessions.archivedSection')} ({archived.length})
              </Button>

              {archiveOpen
                ? archived.map((session) => {
                    const title = titleFor.get(session.id) ?? untitled
                    const active =
                      Boolean(activeSessionPath) && session.path === activeSessionPath
                    return (
                      <ArchivedSessionRow
                        key={session.id}
                        title={title}
                        meta={primeSessionMetaLabel(session, at, { vaultPath })}
                        label={t('ai.sessions.selectAria', { title })}
                        active={active}
                        onSelect={() => select(session)}
                        restoreLabel={t('ai.sessions.restore', { title })}
                        onRestore={() => setArchived(session, false)}
                      />
                    )
                  })
                : null}
            </>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  )
}
