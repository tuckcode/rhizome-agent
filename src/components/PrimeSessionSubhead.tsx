import { CirclesThree, MagnifyingGlass, Plus } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { APP_COMMAND_IDS, getAppCommandShortcutDisplay } from '../hooks/appCommandCatalog'
import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react'
import { cn } from '@/lib/utils'
import { useDragRegion } from '../hooks/useDragRegion'
import { createTranslator, type AppLocale } from '../lib/i18n'
import type { PrimeConnectionProblem } from '../hooks/usePrimeHostStatus'
import { overlayTitleBarBandStyle } from '../utils/trafficLights'
import {
  primeSessionUptime,
  shortPrimeSessionId,
  tildeVaultPath,
} from '../lib/primeSubheadLabels'

interface PrimeSessionSubheadProps {
  locale?: AppLocale
  /** Host is up and holding a session. */
  live: boolean
  sessionId?: string | null
  /** Vault the picker attaches to when it has to spawn a host. */
  vaultPath?: string | null
  /**
   * When the attached session started, ISO-8601.
   *
   * A session outlives the window now (ADR-0163), so how long it has been
   * running is no longer implied by how long the app has been open.
   */
  startedAt?: string | null
  /**
   * Why Prime is unreachable, when it is.
   *
   * Connecting to a service Rhizome does not own brings failure modes owning
   * a child process did not, and ADR-0163 requires they be visible and
   * actionable rather than a spinner.
   */
  problem?: PrimeConnectionProblem | null
  /**
   * The attached conversation's own title, when one has formed.
   *
   * `null`/`undefined` means Prime has not derived one yet — before the first
   * user turn, or while the read is still in flight — and the strip falls
   * back to "New chat" rather than showing nothing.
   */
  sessionTitle?: string | null
  /** Frame A hides AiPanelHeader — New chat lives here instead. */
  onNewChat?: () => void
  /** Open this session's footprint in Mycelium (#22). */
  onOpenFootprint?: () => void
  /** The command palette is otherwise only a menu shortcut. */
  onOpenCommandPalette?: () => void
  /** Current sessions-rail layout width. Collapsed and expanded differ. */
  railLayoutWidth?: number
}

/**
 * The actionable sentence for a connection problem.
 *
 * Returns `null` when there is nothing wrong, so the caller can fall back to
 * the ordinary idle label rather than rendering an empty alarm.
 */
function describeProblem(
  problem: PrimeConnectionProblem | null | undefined,
  t: ReturnType<typeof createTranslator>,
): string | null {
  if (!problem) return null
  switch (problem.code) {
    case 'not_installed':
      return t('ai.subhead.problem.notInstalled')
    case 'service_unreachable':
      return t('ai.subhead.problem.serviceUnreachable')
    case 'service_too_old':
      return problem.installedVersion
        ? t('ai.subhead.problem.serviceTooOld', {
            installed: problem.installedVersion,
            required: problem.requiredVersion,
          })
        : t('ai.subhead.problem.serviceTooOldUnknown', { required: problem.requiredVersion })
    default:
      // An unrecognised code from a newer backend: say nothing rather than
      // render a raw enum at the user.
      return null
  }
}

/** Swallow the mousedown so a click on header chrome does not drag the window. */
function stopHeaderDrag(event: ReactMouseEvent) {
  event.stopPropagation()
}

/**
 * Frame A's title strip: what conversation this is, with everything else
 * behind a status control.
 *
 * A session identifier, a vault path, and an uptime clock used to sit inline
 * next to the connection dot, competing with the one thing a person actually
 * scans for here — which conversation they are in. That instrumentation is
 * still one click away, in the status popover; the strip itself now leads
 * with the title and stays quiet when there is nothing to act on.
 */
export function PrimeSessionSubhead({
  locale = 'en',
  live,
  sessionId,
  vaultPath,
  startedAt,
  problem,
  sessionTitle,
  onNewChat,
  onOpenFootprint,
  onOpenCommandPalette,
  railLayoutWidth,
}: PrimeSessionSubheadProps) {
  const t = createTranslator(locale)
  const titleBarBand = overlayTitleBarBandStyle(railLayoutWidth) as CSSProperties
  // On Chat this strip is the topmost band, so it *is* the title bar. Without
  // a drag region the window cannot be moved at all from here — Notes has one
  // on the breadcrumb bar, Chat had none.
  const { onMouseDown: onDragRegionMouseDown } = useDragRegion<HTMLDivElement>()
  const shortId = shortPrimeSessionId(sessionId)
  const vault = tildeVaultPath(vaultPath)
  // Recomputed on render rather than on a timer of its own. Host status polls
  // every few seconds and re-renders this strip, which is frequent enough for
  // a minute-resolution label — and if polling stops, a frozen uptime is the
  // honest reading, since nothing is confirming the session is alive.
  const uptime = live ? primeSessionUptime(startedAt) : null
  // Connected is connected — a stale problem from before reconnecting must
  // not shout over it.
  const problemMessage = live ? null : describeProblem(problem, t)
  const connectionLabel = live ? t('ai.subhead.live') : (problemMessage ?? t('ai.subhead.idle'))
  // The trimmed title reused from `ai.sessions.newChat` (also the New chat
  // button's own label) rather than a fresh string — one name for "no
  // conversation yet" everywhere it appears.
  const displayTitle = sessionTitle?.trim() || t('ai.sessions.newChat')

  return (
    <div
      className={cn(
        'app-titlebar-band flex min-h-[30px] shrink-0 items-center gap-2.5 pb-1.5 pr-3',
        'select-none',
        // macOS paints overlay traffic lights at x=14 (tauri.conf.json).
        // This strip is ChatHome's title bar, so the inset has to clear
        // them; the 46px rail is already to our left and comes off it.
        'pl-[var(--subhead-traffic-light-inset,0.75rem)]',
      )}
      style={titleBarBand}
      data-testid="prime-session-subhead"
      onMouseDown={onDragRegionMouseDown}
    >
      <span
        className="min-w-0 flex-1 truncate font-sans text-[13px] font-medium text-foreground"
        title={displayTitle}
        data-testid="prime-session-title"
      >
        {displayTitle}
      </span>

      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                'h-[26px] gap-1.5 px-1.5 font-mono text-[11px] font-normal tracking-[0.03em]',
                !problemMessage && 'w-[26px] px-0',
              )}
              onMouseDown={stopHeaderDrag}
              aria-label="Session status"
              data-testid="prime-session-status"
            >
              <span
                aria-hidden="true"
                className={cn(
                  'size-[5px] shrink-0 rounded-full',
                  // Status, not brand: --primary follows the user's accent
                  // choice, so a red accent would make a healthy session
                  // read as an error.
                  live ? 'bg-[var(--accent-green)]' : 'bg-muted-foreground/50',
                )}
              />
              {/* Idle and connected are resting states and stay silent but
                  for the dot — a problem is something to act on, so it stays
                  legible without opening the popover. */}
              {problemMessage ? (
                <span className="truncate text-[var(--accent-amber,inherit)] text-foreground">
                  {problemMessage}
                </span>
              ) : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-64 font-mono text-[11px] tracking-[0.03em] text-muted-foreground"
            onMouseDown={stopHeaderDrag}
          >
            <div className="flex flex-col gap-1.5">
              <span
                className={cn(live && 'text-[var(--accent-green)]')}
                data-testid="prime-subhead-connection"
              >
                {connectionLabel}
              </span>
              {shortId ? (
                <span className="prime-subhead__session" data-testid="prime-subhead-session">
                  sess_<strong className="font-medium text-foreground">{shortId}</strong>
                </span>
              ) : null}
              {vault ? (
                <span className="prime-subhead__vault" data-testid="prime-subhead-vault">
                  {t('ai.subhead.vault')}{' '}
                  <strong className="font-medium text-foreground">{vault}</strong>
                </span>
              ) : null}
              {uptime ? (
                <span className="prime-subhead__uptime" data-testid="prime-subhead-uptime">
                  {t('ai.subhead.uptime')}{' '}
                  <strong className="font-medium text-foreground">{uptime}</strong>
                </span>
              ) : null}
            </div>
          </PopoverContent>
        </Popover>

        {onOpenCommandPalette ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-[32px] gap-1.5 px-2.5 font-sans text-[12px] font-normal"
            onClick={onOpenCommandPalette}
            onMouseDown={stopHeaderDrag}
            aria-label="Command Palette"
            data-testid="open-command-palette"
          >
            <MagnifyingGlass size={14} />
            <span className="prime-subhead__command-label inline-flex items-center gap-1.5">
              Command Palette
              <kbd className="font-sans text-[11px] text-muted-foreground">
                {getAppCommandShortcutDisplay(APP_COMMAND_IDS.viewCommandPalette)}
              </kbd>
            </span>
          </Button>
        ) : null}
        {onOpenFootprint ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="h-[32px] w-[32px] p-0 [&_svg:not([class*=size-])]:size-3.5"
            onClick={onOpenFootprint}
            onMouseDown={stopHeaderDrag}
            aria-label={t('mycelium.title')}
            title={t('mycelium.title')}
            data-testid="prime-session-footprint"
          >
            <CirclesThree size={14} />
          </Button>
        ) : null}
        {onNewChat ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="h-[32px] w-[32px] p-0 [&_svg:not([class*=size-])]:size-3.5"
            onClick={onNewChat}
            onMouseDown={stopHeaderDrag}
            aria-label={t('ai.sessions.newChat')}
            title={t('ai.sessions.newChat')}
          >
            <Plus size={14} />
          </Button>
        ) : null}
      </div>
    </div>
  )
}
