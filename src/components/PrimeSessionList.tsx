import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent as ReactFocusEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react'
import {
  Archive,
  ArrowCounterClockwise,
  ArrowsDownUp,
  CaretRight,
  FunnelSimple,
  PencilSimple,
  Plus,
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { createTranslator, type AppLocale } from '../lib/i18n'
import {
  primeSessionAge,
  primeSessionMatchesFilter,
  primeSessionMatchesQuery,
  primeSessionMetaLabel,
  primeSessionRowTitles,
  primeSessionStatus,
  sortPrimeSessions,
  type PrimeSessionFilterKey,
  type PrimeSessionSortKey,
  type PrimeSessionStatus,
  type PrimeSessionSummary,
} from '../lib/primeSessionMeta'
import {
  trackPrimeSessionArchived,
  trackPrimeSessionListFiltered,
  trackPrimeSessionListOpened,
  trackPrimeSessionListScoped,
  trackPrimeSessionListSorted,
  trackPrimeSessionOpened,
  trackPrimeSessionRenamed,
} from '../lib/productAnalytics'
import { usePrimeRunningSessionFiles } from '../hooks/usePrimeRunningSessionFiles'
import { useDragRegion } from '../hooks/useDragRegion'
import { sessionsColumnTitleBarStyle } from '../utils/trafficLights'
import { copyLocalPath } from '../utils/url'
import { isTauri, mockInvoke } from '../mock-tauri'
import { invoke } from '@tauri-apps/api/core'
import {
  PrimeSessionListContextMenu,
  type PrimeSessionContextMenuState,
} from './PrimeSessionListContextMenu'

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri()) return invoke<T>(cmd, args)
  return mockInvoke<T>(cmd, args)
}

interface PrimeSessionListProps {
  locale?: AppLocale
  /** Chosen session. The caller switches and rehydrates — this list only picks. */
  onSelectSession?: (session: PrimeSessionSummary) => void
  onNewChat?: () => void
  /**
   * Open Mycelium (the codebase citymap) focused on this session's path —
   * same handler as the subhead footprint chip.
   */
  onOpenMycelium?: (sessionPath: string) => void
  /** Path the live host is on, so that row can read as current. */
  activeSessionPath?: string | null
  /**
   * True while the *attached* session is mid-turn. The other rows get their
   * state from the daemon's roster rather than from this — see
   * `usePrimeRunningSessionFiles`.
   */
  working?: boolean
  /**
   * The vault this list was opened from. Rows that ran somewhere else say so;
   * rows from here stay quiet, because naming the open vault on every row is
   * noise. Absent means no comparison, so every row names its place.
   */
  vaultPath?: string | null
  /** Overridable so tests do not depend on the wall clock. */
  now?: number
  /**
   * When the sessions column is the window's top band — no Prime subhead above
   * it — reserve space for macOS traffic lights and make the header draggable.
   */
  titleBarGutter?: boolean
}

/**
 * One session row — Frame F's `session-item`.
 *
 * A 6px status dot, then title over a mono meta line. The dot is outlined
 * normally and filled only while that session is working, so a glance answers
 * "is anything running" without reading a word.
 */
function SessionRowFrame({
  active,
  children,
  onContextMenu,
  onFocus,
}: {
  active: boolean
  children: ReactNode
  onContextMenu?: (event: ReactMouseEvent) => void
  onFocus?: (event: ReactFocusEvent) => void
}) {
  return (
    <div
      className={cn(
        'group relative flex items-stretch rounded-sm border border-transparent',
        'transition-colors hover:border-border hover:bg-background',
        active && 'border-border-strong bg-background',
      )}
      onContextMenu={onContextMenu}
      onFocus={onFocus}
    >
      {children}
    </div>
  )
}

/**
 * Trailing icon actions on a row — rename, archive, restore.
 *
 * Hidden until the row is hovered or something inside is focused, so a list
 * at rest is titles and nothing else. `focus-within` is not optional here:
 * an action that only appears on hover is an action a keyboard cannot reach.
 */
function SessionRowActions({ children }: { children: ReactNode }) {
  return (
    <div
      className={cn(
        'absolute right-1 top-1/2 flex -translate-y-1/2 items-center opacity-0 transition-opacity',
        'group-hover:opacity-100 focus-within:opacity-100',
      )}
    >
      {children}
    </div>
  )
}

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
      className="h-7 w-7 p-0"
    >
      {icon}
    </Button>
  )
}

/**
 * Rows mounted on cold launch. A rail shows about this many. The rest mount
 * when the reader scrolls near the end, or focuses the last mounted row.
 * Search and filter run on the full list first, then this window applies.
 */
export const SESSION_LIST_WINDOW = 24

const SESSION_FILTER_OPTIONS: { value: PrimeSessionFilterKey; label: string }[] = [
  { value: 'all', label: 'All sessions' },
  { value: 'vault', label: 'This vault' },
  { value: 'running', label: 'Running' },
  { value: 'today', label: 'Today' },
]

const SESSION_SORT_OPTIONS: { value: PrimeSessionSortKey; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'title-asc', label: 'Title A to Z' },
  { value: 'title-desc', label: 'Title Z to A' },
]

function SessionListRadioMenu<T extends string>({
  label,
  icon,
  value,
  options,
  testId,
  onChange,
}: {
  label: string
  icon: ReactNode
  value: T
  options: readonly { value: T; label: string }[]
  testId: string
  onChange: (value: T) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="h-7 w-7 p-0"
          aria-label={label}
          title={label}
          data-testid={testId}
        >
          {icon}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[9rem]">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(next) => {
            const match = options.find((option) => option.value === next)
            if (match) onChange(match.value)
          }}
        >
          {options.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function SessionNameInput({
  initialValue,
  onCommit,
  onCancel,
  locale,
}: {
  initialValue: string
  onCommit: (name: string) => void
  onCancel: () => void
  locale: AppLocale
}) {
  const t = createTranslator(locale)
  const [value, setValue] = useState(initialValue)
  const done = useRef(false)
  const finish = (action: () => void) => {
    if (done.current) return
    done.current = true
    action()
  }

  return (
    <div className="grid w-full grid-cols-[6px_1fr] items-start gap-1.5 rounded-sm px-1.5 py-1 pr-2">
      <span aria-hidden="true" className="mt-[3px] size-1.5 rounded-full border border-muted-foreground/50 bg-transparent" />
      <Input
        autoFocus
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onFocus={(event) => event.currentTarget.select()}
        onBlur={(event) => finish(() => onCommit(event.currentTarget.value))}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            finish(() => onCommit(event.currentTarget.value))
          }
          if (event.key === 'Escape') {
            event.preventDefault()
            finish(onCancel)
          }
        }}
        placeholder={t('ai.sessions.renamePlaceholder')}
        aria-label={t('ai.sessions.renameAria')}
        data-testid="prime-session-rename"
        className="h-7 px-2 text-[12px] shadow-none md:text-[12px]"
      />
    </div>
  )
}

function SessionRowButton({
  label,
  title,
  meta,
  active,
  status,
  onSelect,
}: {
  label: string
  title: string
  meta: string | null
  active: boolean
  status: PrimeSessionStatus
  onSelect: () => void
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onSelect}
      aria-label={label}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'grid h-auto w-full min-w-0 grid-cols-[6px_1fr] items-start justify-start gap-1.5 rounded-sm',
        'px-1.5 py-1 pr-12 text-left font-normal whitespace-normal shadow-none',
        'hover:bg-transparent hover:text-foreground dark:hover:bg-transparent',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'mt-[3px] size-1.5 rounded-full border',
          // Three states, not two. Filled with a ring: turning right now.
          // Filled, no ring: the daemon still holds it, sitting idle — a
          // session outlives the window (ADR-0163), so that is a real and
          // different answer from the third: outlined, just a log on disk.
          status === 'working' &&
            'border-[var(--accent-green)] bg-[var(--accent-green)] ring-2 ring-[var(--accent-green)]/25',
          status === 'running' && 'border-[var(--accent-green)] bg-[var(--accent-green)]',
          status === 'saved' && 'border-muted-foreground/50 bg-transparent',
        )}
      />
      <span className="min-w-0">
        <span className="block truncate text-[11px] leading-tight text-foreground" title={title}>
          {title}
        </span>
        {meta ? (
          <span className="mt-px block truncate font-mono text-[10px] tracking-[0.02em] text-muted-foreground">
            {meta}
          </span>
        ) : null}
      </span>
    </Button>
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
const LiveSessionRow = memo(function LiveSessionRow({
  sessionId,
  label,
  title,
  meta,
  active,
  status,
  onSelectId,
  onContextMenuId,
  renameLabel,
  onRenameId,
  archiveLabel,
  onArchiveId,
  onReachEnd,
}: {
  sessionId: string
  label: string
  title: string
  meta: string | null
  active: boolean
  status: PrimeSessionStatus
  onSelectId: (id: string) => void
  onContextMenuId: (id: string, event: ReactMouseEvent) => void
  renameLabel: string
  onRenameId: (id: string) => void
  archiveLabel: string
  onArchiveId: (id: string) => void
  onReachEnd?: () => void
}) {
  return (
    <SessionRowFrame
      active={active}
      onFocus={onReachEnd ? () => onReachEnd() : undefined}
      onContextMenu={(event) => onContextMenuId(sessionId, event)}
    >
      <SessionRowButton
        label={label}
        title={title}
        meta={meta}
        active={active}
        status={status}
        onSelect={() => onSelectId(sessionId)}
      />
      <SessionRowActions>
        <SessionRowAction label={renameLabel} icon={<PencilSimple size={13} />} onClick={() => onRenameId(sessionId)} />
        <SessionRowAction label={archiveLabel} icon={<Archive size={13} />} onClick={() => onArchiveId(sessionId)} />
      </SessionRowActions>
    </SessionRowFrame>
  )
})

/** A filed session. Same row, and its action puts it back. */
const ArchivedSessionRow = memo(function ArchivedSessionRow({
  sessionId,
  label,
  title,
  meta,
  active,
  onSelectId,
  onContextMenuId,
  renameLabel,
  onRenameId,
  restoreLabel,
  onRestoreId,
  onReachEnd,
}: {
  sessionId: string
  label: string
  title: string
  meta: string | null
  active: boolean
  onSelectId: (id: string) => void
  onContextMenuId: (id: string, event: ReactMouseEvent) => void
  renameLabel: string
  onRenameId: (id: string) => void
  restoreLabel: string
  onRestoreId: (id: string) => void
  onReachEnd?: () => void
}) {
  return (
    <SessionRowFrame
      active={active}
      onFocus={onReachEnd ? () => onReachEnd() : undefined}
      onContextMenu={(event) => onContextMenuId(sessionId, event)}
    >
      <SessionRowButton
        label={label}
        title={title}
        meta={meta}
        active={active}
        // Filed out of the way, so it does not claim attention with a live
        // dot even if the daemon still holds it — the archive is where you
        // put the things you are not watching.
        status="saved"
        onSelect={() => onSelectId(sessionId)}
      />
      <SessionRowActions>
        <SessionRowAction label={renameLabel} icon={<PencilSimple size={13} />} onClick={() => onRenameId(sessionId)} />
        <SessionRowAction
          label={restoreLabel}
          icon={<ArrowCounterClockwise size={13} />}
          onClick={() => onRestoreId(sessionId)}
        />
      </SessionRowActions>
    </SessionRowFrame>
  )
})

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
  onOpenMycelium,
  activeSessionPath = null,
  working = false,
  vaultPath = null,
  now,
  titleBarGutter = false,
}: PrimeSessionListProps) {
  const t = createTranslator(locale)
  const titleBarStyle = titleBarGutter ? (sessionsColumnTitleBarStyle() as CSSProperties) : undefined
  const { onMouseDown: onTitleBarMouseDown } = useDragRegion<HTMLDivElement>()
  const [sessions, setSessions] = useState<PrimeSessionSummary[] | null>(null)
  // Captured when the data is read, not at render: the label should describe
  // the moment the list was true, and reading a clock in a memo is impure.
  const [loadedAt, setLoadedAt] = useState(() => Date.now())
  const [error, setError] = useState<{ kind: 'list' | 'action'; message: string } | null>(null)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [filterKey, setFilterKey] = useState<PrimeSessionFilterKey>('all')
  const [sortKey, setSortKey] = useState<PrimeSessionSortKey>('newest')
  const [liveWindow, setLiveWindow] = useState(SESSION_LIST_WINDOW)
  const [archiveWindow, setArchiveWindow] = useState(SESSION_LIST_WINDOW)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [ctxMenu, setCtxMenu] = useState<PrimeSessionContextMenuState | null>(null)
  const ctxMenuRef = useRef<HTMLDivElement>(null)
  const listRootRef = useRef<HTMLDivElement>(null)
  const filterTracked = useRef(false)
  // Which of these logs the daemon still holds. Polled only while this column
  // is mounted, which is while it is open.
  const running = usePrimeRunningSessionFiles(true)

  const closeContextMenu = useCallback(() => setCtxMenu(null), [])

  useEffect(() => {
    if (!ctxMenu) return

    const handleOutsideClick = (event: MouseEvent) => {
      if (ctxMenuRef.current && !ctxMenuRef.current.contains(event.target as Node)) {
        closeContextMenu()
      }
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeContextMenu()
    }

    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [ctxMenu, closeContextMenu])

  const openContextMenu = useCallback((session: PrimeSessionSummary, event: ReactMouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setCtxMenu({ x: event.clientX, y: event.clientY, session })
  }, [])

  const copySessionPath = useCallback((sessionPath: string) => {
    void copyLocalPath(sessionPath)
  }, [])

  /**
   * The row's accessible name, carrying its state.
   *
   * The dot is `aria-hidden` — it has to be, it is decoration — so without
   * this "running vs saved is distinguishable" is only true for people who
   * can see colour. A screen reader heard four identical "Open session X"
   * buttons whatever was happening in them.
   */
  const rowLabel = (title: string, status: PrimeSessionStatus): string => {
    const name = t('ai.sessions.selectAria', { title })
    if (status === 'working') return `${name} — ${t('ai.sessions.statusWorking')}`
    if (status === 'running') return `${name} — ${t('ai.sessions.statusRunning')}`
    return name
  }

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
      setError(failure ? { kind: 'list', message: failure } : null)
      setLoadedAt(Date.now())
      setSessions(listed)
      trackPrimeSessionListOpened(listed.length)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const ordered = useMemo(
    () => sortPrimeSessions(sessions ?? [], sortKey),
    [sessions, sortKey],
  )
  const at = now ?? loadedAt
  const untitled = t('ai.sessions.untitled')
  // Computed across the whole list rather than per row: whether a title needs
  // disambiguating is a property of its neighbours, not of the session. Left
  // to the React Compiler rather than a `useMemo` — `untitled` comes from
  // `t()`, a fresh value every render, so a hand-written memo cannot hold.
  //
  // Across *both* sections, not each on its own: a session keeps the label it
  // had when it is filed, so archiving a row does not rename its neighbour.
  //
  // Meta is computed first and fed in, because whether a title needs a suffix
  // depends on what the *rest of the row* already says (#33).
  const statusFor = new Map(
    ordered.map((session) => {
      const isActive = Boolean(activeSessionPath) && session.path === activeSessionPath
      // The attached session's own turn is known here first — the roster poll
      // is 4s behind — so it wins for that one row. An archived row never
      // claims a live dot: the archive is where you put what you are not
      // watching.
      const status: PrimeSessionStatus = session.archived
        ? 'saved'
        : isActive && working
          ? 'working'
          : primeSessionStatus(session, running)
      return [session.id, status] as const
    }),
  )
  const metaFor = new Map(
    ordered.map((session) => [
      session.id,
      primeSessionMetaLabel(session, at, {
        working: statusFor.get(session.id) === 'working',
        vaultPath,
      }),
    ]),
  )
  const titles = primeSessionRowTitles(
    ordered,
    untitled,
    ordered.map((session) => metaFor.get(session.id) ?? null),
  )
  const titleFor = new Map(ordered.map((session, index) => [session.id, titles[index] ?? untitled]))
  // Scratch sessions ran in a temp directory — test runs and probes, each of
  // which creates a real session in Prime's shared store. On one machine they
  // were 41 of 136 and outnumbered the vault's own sessions in the recent
  // list. Grouped with archived rather than dropped: same rule as everywhere
  // else here, separate but still reachable, and the search still finds them.
  const live = ordered.filter((session) => !session.archived && !session.scratch)
  const archived = ordered.filter((session) => session.archived || session.scratch)
  const searching = query.trim().length > 0
  const inScope = (session: PrimeSessionSummary) =>
    primeSessionMatchesFilter(session, filterKey, { now: at, vaultPath, running })
  const visibleLive = live.filter(
    (session) =>
      inScope(session) && primeSessionMatchesQuery(session, query, titleFor.get(session.id)),
  )
  const visibleArchived = archived.filter(
    (session) =>
      inScope(session) && primeSessionMatchesQuery(session, query, titleFor.get(session.id)),
  )
  const noMatches =
    (searching || filterKey !== 'all') &&
    visibleLive.length === 0 &&
    visibleArchived.length === 0
  const showArchived = archiveOpen || (searching && visibleArchived.length > 0)
  const shownLive = visibleLive.slice(0, liveWindow)
  const shownArchived = visibleArchived.slice(0, archiveWindow)

  useEffect(() => {
    if (!searching || filterTracked.current) return
    filterTracked.current = true
    trackPrimeSessionListFiltered(visibleLive.length + visibleArchived.length)
  }, [searching, visibleArchived.length, visibleLive.length])

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
          setError({
            kind: 'action',
            message: e instanceof Error ? e.message : String(e),
          })
        },
      )
    },
    [],
  )

  const startRename = useCallback((session: PrimeSessionSummary) => {
    setRenamingId(session.id)
  }, [])

  const cancelRename = useCallback(() => {
    setRenamingId(null)
  }, [])

  /**
   * Name a session from the list.
   *
   * The title moves first and the host is told after, same as archiving:
   * a rename is a label, and waiting on the daemon to redraw would make
   * typing feel like it missed. A refusal puts the previous title back.
   * An empty draft is not a name — the daemon rejects one — so it cancels
   * rather than sending.
   */
  const commitRename = useCallback(
    (session: PrimeSessionSummary, draft: string) => {
      const name = draft.trim()
      const previous = session.title?.trim() ?? ''
      setRenamingId(null)
      if (!name || name === previous) return

      setSessions((current) =>
        (current ?? []).map((entry) => (entry.id === session.id ? { ...entry, title: name } : entry)),
      )
      trackPrimeSessionRenamed()
      void (async () => {
        try {
          if (vaultPath) {
            await call('ensure_prime_session_host', { vaultPath })
          }
          await call('rename_prime_session', { path: session.path, name })
        } catch (e: unknown) {
          setSessions((current) =>
            (current ?? []).map((entry) =>
              entry.id === session.id ? { ...entry, title: session.title } : entry,
            ),
          )
          setError({
            kind: 'action',
            message: e instanceof Error ? e.message : String(e),
          })
        }
      })()
    },
    [vaultPath],
  )

  const findSession = useCallback(
    (id: string) => sessions?.find((entry) => entry.id === id),
    [sessions],
  )
  const selectById = useCallback((id: string) => {
    const session = findSession(id)
    if (session) select(session)
  }, [findSession, select])
  const contextMenuById = useCallback((id: string, event: ReactMouseEvent) => {
    const session = findSession(id)
    if (session) openContextMenu(session, event)
  }, [findSession, openContextMenu])
  const renameById = useCallback((id: string) => {
    const session = findSession(id)
    if (session) startRename(session)
  }, [findSession, startRename])
  const archiveById = useCallback((id: string) => {
    const session = findSession(id)
    if (session) setArchived(session, true)
  }, [findSession, setArchived])
  const restoreById = useCallback((id: string) => {
    const session = findSession(id)
    if (session) setArchived(session, false)
  }, [findSession, setArchived])
  const revealMoreLive = useCallback(() => {
    setLiveWindow((count) => count + SESSION_LIST_WINDOW)
  }, [])
  const revealMoreArchived = useCallback(() => {
    setArchiveWindow((count) => count + SESSION_LIST_WINDOW)
  }, [])

  useEffect(() => {
    const viewport = listRootRef.current?.querySelector('[data-slot="scroll-area-viewport"]')
    if (!(viewport instanceof HTMLElement)) return
    const liveLength = visibleLive.length
    const archivedLength = visibleArchived.length
    const onScroll = () => {
      if (viewport.clientHeight <= 0) return
      const remaining = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
      if (remaining >= 80) return
      setLiveWindow((count) => (count >= liveLength ? count : Math.min(liveLength, count + SESSION_LIST_WINDOW)))
      setArchiveWindow((count) => (
        count >= archivedLength ? count : Math.min(archivedLength, count + SESSION_LIST_WINDOW)
      ))
    }
    viewport.addEventListener('scroll', onScroll, { passive: true })
    return () => viewport.removeEventListener('scroll', onScroll)
  }, [visibleArchived.length, visibleLive.length])

  return (
    <div ref={listRootRef} className="flex h-full w-full min-w-0 flex-col" data-testid="prime-session-list">
      <div
        className={cn(
          'flex shrink-0 items-center justify-between gap-2 border-b border-border px-2.5',
          titleBarGutter ? 'pl-[var(--subhead-traffic-light-inset,0.625rem)]' : 'h-10',
        )}
        style={titleBarStyle}
        data-testid="prime-session-list-header"
        onMouseDown={titleBarGutter ? onTitleBarMouseDown : undefined}
      >
        <span className="font-mono-overline uppercase text-muted-foreground">
          {t('ai.sessions.title')}
        </span>
        <div className="flex items-center gap-0.5">
          {sessions !== null && ordered.length > 0 ? (
            <>
              <SessionListRadioMenu
                label="Filter"
                icon={<FunnelSimple size={14} />}
                value={filterKey}
                options={SESSION_FILTER_OPTIONS}
                testId="prime-session-filter"
                onChange={(next) => {
                  setFilterKey(next)
                  setLiveWindow(SESSION_LIST_WINDOW)
                  setArchiveWindow(SESSION_LIST_WINDOW)
                  trackPrimeSessionListScoped(next)
                }}
              />
              <SessionListRadioMenu
                label="Sort"
                icon={<ArrowsDownUp size={14} />}
                value={sortKey}
                options={SESSION_SORT_OPTIONS}
                testId="prime-session-sort"
                onChange={(next) => {
                  setSortKey(next)
                  setLiveWindow(SESSION_LIST_WINDOW)
                  setArchiveWindow(SESSION_LIST_WINDOW)
                  trackPrimeSessionListSorted(next)
                }}
              />
            </>
          ) : null}
          {onNewChat ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="h-7 w-7 p-0"
              onClick={onNewChat}
              aria-label={t('ai.sessions.newChat')}
              title={t('ai.sessions.newChat')}
            >
              <Plus size={14} />
            </Button>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="px-2.5 py-3 text-xs text-destructive" role="alert">
          {error.kind === 'list'
            ? t('ai.sessions.error', { message: error.message })
            : t('ai.sessions.actionError', { message: error.message })}
        </p>
      ) : null}

      {sessions !== null && ordered.length > 0 ? (
        <div className="px-1.5 py-1">
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setLiveWindow(SESSION_LIST_WINDOW)
              setArchiveWindow(SESSION_LIST_WINDOW)
            }}
            placeholder={t('ai.sessions.searchPlaceholder')}
            aria-label={t('ai.sessions.search')}
            data-testid="prime-session-search"
            className="h-7 px-2 text-[12px] shadow-none md:text-[12px]"
          />
        </div>
      ) : null}

      {/* `sessions === null` is "not read yet", and it used to render nothing
          at all — a blank column with no heading, no message and no spinner.
          A read that is slow, or one that never resolves, is then
          indistinguishable from a person having no sessions, and from the
          panel being broken. Say which. */}
      {sessions === null && !error ? (
        <p className="px-2.5 py-3 text-xs text-muted-foreground">{t('ai.sessions.loading')}</p>
      ) : null}

      {sessions !== null && !error && ordered.length === 0 ? (
        <p className="px-2.5 py-3 text-xs text-muted-foreground">{t('ai.sessions.empty')}</p>
      ) : null}

      {noMatches ? (
        <p className="px-2.5 py-3 text-xs text-muted-foreground">{t('ai.sessions.noMatches')}</p>
      ) : null}

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-0 p-1">
          {shownLive.map((session, index) => {
            const title = titleFor.get(session.id) ?? untitled
            const active = Boolean(activeSessionPath) && session.path === activeSessionPath
            const status = statusFor.get(session.id) ?? 'saved'
            const atEnd = index === shownLive.length - 1 && shownLive.length < visibleLive.length
            if (renamingId === session.id) {
              return (
                <SessionRowFrame key={session.id} active={active} onFocus={atEnd ? revealMoreLive : undefined}>
                  <SessionNameInput
                    initialValue={session.title?.trim() ?? ''}
                    onCommit={(name) => commitRename(session, name)}
                    onCancel={cancelRename}
                    locale={locale}
                  />
                </SessionRowFrame>
              )
            }
            return (
              <LiveSessionRow
                key={session.id}
                sessionId={session.id}
                title={title}
                meta={metaFor.get(session.id) ?? null}
                label={rowLabel(title, status)}
                active={active}
                status={status}
                onSelectId={selectById}
                onContextMenuId={contextMenuById}
                renameLabel={t('ai.sessions.rename', { title })}
                onRenameId={renameById}
                archiveLabel={t('ai.sessions.archive', { title })}
                onArchiveId={archiveById}
                onReachEnd={atEnd ? revealMoreLive : undefined}
              />
            )
          })}

          {visibleArchived.length > 0 ? (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setArchiveOpen((open) => !open)}
                aria-expanded={showArchived}
                className={cn(
                  'mt-1 h-7 justify-start gap-1 px-2 font-mono text-[10px] uppercase',
                  'tracking-[0.1em] text-muted-foreground',
                )}
              >
                <CaretRight
                  size={10}
                  aria-hidden="true"
                  className={cn('transition-transform', showArchived && 'rotate-90')}
                />
                {t('ai.sessions.archivedSection')} ({visibleArchived.length})
              </Button>

              {showArchived
                ? shownArchived.map((session, index) => {
                    const title = titleFor.get(session.id) ?? untitled
                    const active =
                      Boolean(activeSessionPath) && session.path === activeSessionPath
                    const atEnd = index === shownArchived.length - 1 && shownArchived.length < visibleArchived.length
                    if (renamingId === session.id) {
                      return (
                        <SessionRowFrame key={session.id} active={active} onFocus={atEnd ? revealMoreArchived : undefined}>
                          <SessionNameInput
                            initialValue={session.title?.trim() ?? ''}
                            onCommit={(name) => commitRename(session, name)}
                            onCancel={cancelRename}
                            locale={locale}
                          />
                        </SessionRowFrame>
                      )
                    }
                    return (
                      <ArchivedSessionRow
                        key={session.id}
                        sessionId={session.id}
                        title={title}
                        meta={metaFor.get(session.id) ?? null}
                        label={t('ai.sessions.selectAria', { title })}
                        active={active}
                        onSelectId={selectById}
                        onContextMenuId={contextMenuById}
                        renameLabel={t('ai.sessions.rename', { title })}
                        onRenameId={renameById}
                        restoreLabel={t('ai.sessions.restore', { title })}
                        onRestoreId={restoreById}
                        onReachEnd={atEnd ? revealMoreArchived : undefined}
                      />
                    )
                  })
                : null}
            </>
          ) : null}
        </div>
      </ScrollArea>

      <PrimeSessionListContextMenu
        ctxMenu={ctxMenu}
        ctxMenuRef={ctxMenuRef}
        onOpen={select}
        onRename={startRename}
        onSetArchived={setArchived}
        onOpenMycelium={onOpenMycelium}
        onCopyPath={copySessionPath}
        onClose={closeContextMenu}
      />
    </div>
  )
}
