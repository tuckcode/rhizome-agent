import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowClockwise, ChatCircleDots, CircleNotch } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { createTranslator, type AppLocale } from '../lib/i18n'
import {
  groupPrimeSessions,
  relativeSessionTime,
  type PrimeSessionGroupKey,
  type PrimeSessionSummary,
} from '../lib/primeSessionGroups'
import { trackPrimeSessionListOpened, trackPrimeSessionOpened } from '../lib/productAnalytics'
import { isTauri, mockInvoke } from '../mock-tauri'
import { invoke } from '@tauri-apps/api/core'

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri()) return invoke<T>(cmd, args)
  return mockInvoke<T>(cmd, args)
}

interface PrimeSessionListProps {
  locale?: AppLocale
  /** Chosen session. The caller loads the transcript — this list only picks. */
  onSelectSession?: (session: PrimeSessionSummary) => void
  /** Overridable so tests do not depend on the wall clock. */
  now?: number
}

/** Last path segment — the project a session ran in, without the full path. */
function projectLabel(cwd: string | null | undefined): string | null {
  if (!cwd) return null
  const trimmed = cwd.replace(/\/+$/, '')
  const name = trimmed.slice(trimmed.lastIndexOf('/') + 1)
  return name || null
}

/**
 * One session row.
 *
 * Anatomy follows the design system's `ra-session-item`: an 8px status column,
 * then title over a meta line. The meta is project + relative time, which is
 * what tells you whether a row is the thing you were just doing.
 */
/** `rhizome-agent · 2m ago` — project and staleness, the two things a row answers. */
function metaFor(session: PrimeSessionSummary, now: number): string | null {
  const parts = [projectLabel(session.cwd), relativeSessionTime(session, now)].filter(Boolean)
  return parts.length ? parts.join(' · ') : null
}

function SessionRow({
  session,
  label,
  title,
  meta,
  selected,
  onSelect,
}: {
  session: PrimeSessionSummary
  label: string
  title: string
  meta: string | null
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={label}
      aria-current={selected ? 'true' : undefined}
      data-session-id={session.id}
      className={cn(
        'grid w-full grid-cols-[8px_1fr] items-start gap-2 rounded-sm border border-transparent',
        'px-2 py-[9px] text-left transition-colors',
        'hover:border-border hover:bg-background',
        selected && 'border-border-strong bg-background',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'mt-1.5 size-1.5 rounded-full',
          selected ? 'bg-primary' : 'bg-muted-foreground/40',
        )}
      />
      <span className="min-w-0">
        <span className="block truncate text-[13px] leading-5 text-foreground">{title}</span>
        {meta ? (
          <span className="block truncate text-[11px] leading-4 text-muted-foreground">{meta}</span>
        ) : null}
      </span>
    </button>
  )
}

/**
 * Past Prime sessions, grouped by when they were last active.
 *
 * Reads summaries only. Transcripts are loaded by whoever handles the
 * selection, so opening this list never reads a 2 MB log.
 */
export default function PrimeSessionList({
  locale = 'en',
  onSelectSession,
  now,
}: PrimeSessionListProps) {
  const t = createTranslator(locale)
  const [sessions, setSessions] = useState<PrimeSessionSummary[] | null>(null)
  // Captured when the list is read, not when it renders: grouping should
  // reflect the moment the data was true, and reading the clock inside a memo
  // is impure anyway.
  const [loadedAt, setLoadedAt] = useState(() => Date.now())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    // Nothing sets state before this await: a synchronous setState at the head
    // of an effect-driven load cascades an extra render for no gain.
    let listed: PrimeSessionSummary[] = []
    let failure: string | null = null
    try {
      listed = await call<PrimeSessionSummary[]>('list_prime_session_summaries')
    } catch (e) {
      failure = e instanceof Error ? e.message : String(e)
    }
    setError(failure)
    setLoadedAt(Date.now())
    setSessions(listed)
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      // Awaits before touching state, so the effect body itself never renders
      // a second time synchronously.
      let listed: PrimeSessionSummary[] = []
      let failure: string | null = null
      try {
        listed = await call<PrimeSessionSummary[]>('list_prime_session_summaries')
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

  const groups = useMemo(
    () => groupPrimeSessions(sessions ?? [], now ?? loadedAt),
    [sessions, now, loadedAt],
  )

  const select = (session: PrimeSessionSummary, group: PrimeSessionGroupKey) => {
    setSelectedId(session.id)
    trackPrimeSessionOpened(group)
    onSelectSession?.(session)
  }

  const untitled = t('ai.sessions.untitled')

  return (
    <div className="flex h-full flex-col" data-testid="prime-session-list">
      <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-border px-2.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
          {t('ai.sessions.title')}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => void refresh()}
          aria-label={t('ai.sessions.refresh')}
        >
          <ArrowClockwise size={14} />
        </Button>
      </div>

      {sessions === null ? (
        <div
          className="flex items-center gap-2 px-2 py-3 text-xs text-muted-foreground"
          role="status"
        >
          <CircleNotch size={14} className="animate-spin" />
          {t('ai.sessions.loading')}
        </div>
      ) : null}

      {error ? (
        <p className="px-2 py-3 text-xs text-destructive" role="alert">
          {t('ai.sessions.error', { message: error })}
        </p>
      ) : null}

      {sessions !== null && !error && groups.length === 0 ? (
        <p className="flex items-center gap-2 px-2 py-3 text-xs text-muted-foreground">
          <ChatCircleDots size={14} />
          {t('ai.sessions.empty')}
        </p>
      ) : null}

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-2 px-1 pb-2">
          {groups.map((group) => (
            <div key={group.key} className="flex flex-col">
              <span className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {t(`ai.sessions.group.${group.key}`)}
              </span>
              {group.sessions.map((session) => {
                const title = session.title?.trim() || untitled
                return (
                  <SessionRow
                    key={session.id}
                    session={session}
                    title={title}
                    meta={metaFor(session, now ?? loadedAt)}
                    label={t('ai.sessions.selectAria', { title })}
                    selected={session.id === selectedId}
                    onSelect={() => select(session, group.key)}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
