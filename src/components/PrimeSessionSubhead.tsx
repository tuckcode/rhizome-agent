import { CirclesThree, MagnifyingGlass, Plus } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { APP_COMMAND_IDS, getAppCommandShortcutDisplay } from '../hooks/appCommandCatalog'
import type { CSSProperties } from 'react'
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

function Separator() {
  return <span aria-hidden="true" className="h-3 w-px shrink-0 bg-border" />
}

/**
 * Frame A's telemetry strip: what session you are in, against what vault.
 *
 * Mono and muted on purpose — this is instrumentation, not content. Model,
 * thinking level, and vault switching live on the composer (#38), where the
 * hands already are. Duplicating them here is how the two would disagree.
 */
export function PrimeSessionSubhead({
  locale = 'en',
  live,
  sessionId,
  vaultPath,
  startedAt,
  problem,
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
  const problemMessage = describeProblem(problem, t)

  return (
    <div
      className={cn(
        'app-titlebar-band flex min-h-[30px] shrink-0 items-end gap-2.5 pb-1.5 pr-3',
        'font-mono text-[11px] tracking-[0.03em] text-muted-foreground',
        // This strip is the window's title bar, so a drag on it has to move
        // the window. Selectable text wins the gesture instead: the pointer
        // sweeps a text selection and the window never moves, which leaves a
        // maximised window with no obvious way to grab it.
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
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <span
          aria-hidden="true"
          className={cn(
            'size-[5px] rounded-full',
            // Status, not brand: --primary follows the user's accent choice, so
            // a red accent would make a healthy session read as an error.
            live ? 'bg-[var(--accent-green)]' : 'bg-muted-foreground/50',
          )}
        />
        <span
          className={cn(
            'truncate',
            live && 'text-[var(--accent-green)]',
            // A problem is not the same as idle: idle is a resting state, this
            // is something the user has to act on.
            !live && problemMessage && 'text-[var(--accent-amber,inherit)] text-foreground',
          )}
          title={live ? t('ai.subhead.live') : (problemMessage ?? t('ai.subhead.idle'))}
        >
          {live ? t('ai.subhead.live') : (problemMessage ?? t('ai.subhead.idle'))}
        </span>
      </span>

      {shortId ? (
        <>
          <Separator />
          <span className="prime-subhead__session shrink-0">
            sess_<strong className="font-medium text-foreground">{shortId}</strong>
          </span>
        </>
      ) : null}

      {vault ? (
        <>
          <Separator />
          <span className="min-w-0 truncate">
            {t('ai.subhead.vault')} <strong className="font-medium text-foreground">{vault}</strong>
          </span>
        </>
      ) : null}

      {uptime ? (
        <>
          <Separator />
          <span className="prime-subhead__uptime shrink-0">
            {t('ai.subhead.uptime')}{' '}
            <strong className="font-medium text-foreground">{uptime}</strong>
          </span>
        </>
      ) : null}

      {onOpenCommandPalette || onOpenFootprint || onNewChat ? (
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {onOpenCommandPalette ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-[32px] gap-1.5 px-2.5 font-sans text-[12px] font-normal"
              onClick={onOpenCommandPalette}
              onMouseDown={(event) => event.stopPropagation()}
              data-testid="open-command-palette"
            >
              <MagnifyingGlass size={14} />
              Command Palette
              <kbd className="font-sans text-[11px] text-muted-foreground">
                {getAppCommandShortcutDisplay(APP_COMMAND_IDS.viewCommandPalette)}
              </kbd>
            </Button>
          ) : null}
          {onOpenFootprint ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="h-[32px] w-[32px] p-0 [&_svg:not([class*=size-])]:size-3.5"
              onClick={onOpenFootprint}
              onMouseDown={(event) => event.stopPropagation()}
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
              aria-label={t('ai.sessions.newChat')}
              title={t('ai.sessions.newChat')}
            >
              <Plus size={14} />
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
