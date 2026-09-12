import { useEffect, useRef, useState } from 'react'
import { ChatCircle, GearSix, GitBranch, MagnifyingGlass, PushPin, Tray } from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { ActionTooltip } from './ui/action-tooltip'
import { Button } from './ui/button'
import { createTranslator, type AppLocale } from '../lib/i18n'
import { trackRailDestinationClicked } from '../lib/productAnalytics'
import { APP_STORAGE_KEYS } from '../constants/appStorage'
import { readStoredBooleanPreference, writeStoredBooleanPreference } from '../lib/uiPreference'
import { usePanelWidth } from '../hooks/usePanelWidth'
import { startResizeDrag } from '../utils/startResizeDrag'
import {
  COMMAND_RAIL_TRAFFIC_LIGHT_INSET,
  hasNativeMacosTrafficLights,
} from '../utils/trafficLights'

export type CommandRailDestination = 'chat' | 'inbox' | 'research' | 'changes'

interface CommandRailProps {
  locale: AppLocale
  activeDestination: CommandRailDestination
  inboxCount?: number
  onSelectChat: () => void
  onSelectInbox: () => void
  onSelectResearch: () => void
  onSelectChanges: () => void
  onOpenSettings: () => void
  /** Expanded rail's open middle, where Chat mounts its session list. */
  onSessionsSlotReady?: (slot: HTMLDivElement | null) => void
}

const RAIL_BUTTON_SIZE = 30
const RAIL_ICON_SIZE = 16
const RAIL_COLLAPSED_WIDTH = 46
const RAIL_EXPANDED_DEFAULT_WIDTH = 240
const RAIL_EXPANDED_MIN_WIDTH = 180
const RAIL_EXPANDED_MAX_WIDTH = 360
const RAIL_HOVER_OPEN_DELAY_MS = 150
const RAIL_HOVER_CLOSE_DELAY_MS = 180
/**
 * Room for the macOS traffic lights, in both rail states.
 *
 * `tauri.conf.json` puts them at x=58, y=16. Expanded, the 240px rail runs
 * underneath them. Collapsed, the 46px rail clears them horizontally — but the
 * lights then sit level with the first destination, close enough to read as
 * part of it. The visual audit's words: "the lights themselves still look
 * parked on the first destination."
 *
 * So the inset applies whenever the lights exist, and content starts below
 * them the way it does in every macOS sidebar. Off-Mac there are no lights to
 * make room for, and the space would just be a dent in the top of the rail.
 */
function RailButton({
  active,
  badge,
  expanded,
  icon: IconComponent,
  label,
  onClick,
  testId,
}: {
  active: boolean
  badge?: number
  expanded: boolean
  icon: Icon
  label: string
  onClick: () => void
  testId: string
}) {
  const button = (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      data-testid={testId}
      className={
        expanded
          ? `relative flex w-full items-center justify-start gap-2 rounded-[var(--radius)] px-2 ${
              active ? '' : 'hover:bg-[var(--state-hover,var(--accent))]'
            }`
          : `relative rounded-[var(--radius)] p-0 ${
              active ? '' : 'hover:bg-[var(--state-hover,var(--accent))]'
            }`
      }
      style={{
        width: expanded ? '100%' : RAIL_BUTTON_SIZE,
        height: RAIL_BUTTON_SIZE,
        color: active ? 'var(--accent-blue)' : 'var(--text-muted)',
        backgroundColor: active ? 'var(--accent-blue-bg)' : undefined,
      }}
    >
      <IconComponent size={RAIL_ICON_SIZE} weight={active ? 'fill' : 'regular'} />
      {expanded ? <span className="truncate text-[13px] leading-none">{label}</span> : null}
      {badge && badge > 0 ? (
        <span
          className={expanded
            ? 'ml-auto min-w-[18px] rounded-full bg-muted px-1.5 text-center text-[10px] leading-[18px]'
            : 'absolute right-0 top-0 min-w-[14px] rounded-full bg-muted px-1 text-center text-[9px] leading-[14px]'}
          aria-label={`${badge}`}
        >
          {badge > 99 ? '99+' : badge}
        </span>
      ) : null}
    </Button>
  )

  // A tooltip that repeats a label already on screen is noise, and it steals
  // the pointer from a target the user can already read.
  return expanded ? button : (
    <ActionTooltip copy={{ label }} side="right">
      {button}
    </ActionTooltip>
  )
}

/**
 * Wave 5.3 icon command rail — behind `shell_command_rail`. See
 * docs/design/shell-final-direction.md §2.2. Fixed 46px, not resizable;
 * destinations reuse the exact handlers the legacy status-bar buttons
 * already call (same Graph toggle history semantics, same Research canvas,
 * same Changes filter) so behavior is identical, only the entry point moves.
 */
export function CommandRail({
  locale,
  activeDestination,
  inboxCount = 0,
  onSelectChat,
  onSelectInbox,
  onSelectResearch,
  onSelectChanges,
  onOpenSettings,
  onSessionsSlotReady,
}: CommandRailProps) {
  const t = createTranslator(locale)
  const [pinnedExpanded, setPinnedExpanded] = useState(() =>
    readStoredBooleanPreference(APP_STORAGE_KEYS.commandRailExpanded, false),
  )
  const [hoverExpanded, setHoverExpanded] = useState(false)
  const railWidth = usePanelWidth(
    APP_STORAGE_KEYS.commandRailWidth,
    RAIL_EXPANDED_DEFAULT_WIDTH,
    RAIL_EXPANDED_MIN_WIDTH,
    RAIL_EXPANDED_MAX_WIDTH,
  )
  const railRef = useRef<HTMLDivElement>(null)
  const hoverOpenTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hoverCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const expanded = pinnedExpanded || hoverExpanded
  const openFromHover = () => {
    if (hoverCloseTimer.current) clearTimeout(hoverCloseTimer.current)
    hoverCloseTimer.current = null
    if (pinnedExpanded || hoverExpanded || hoverOpenTimer.current) return
    hoverOpenTimer.current = setTimeout(() => {
      setHoverExpanded(true)
      hoverOpenTimer.current = null
    }, RAIL_HOVER_OPEN_DELAY_MS)
  }
  const cancelPendingHoverOpen = () => {
    if (hoverOpenTimer.current) clearTimeout(hoverOpenTimer.current)
    hoverOpenTimer.current = null
  }
  useEffect(() => {
    if (!hoverExpanded || pinnedExpanded) return

    const trackPointer = (event: MouseEvent) => {
      const bounds = railRef.current?.getBoundingClientRect()
      const pointerInside = bounds
        && event.clientX >= bounds.left
        && event.clientX <= bounds.right
        && event.clientY >= bounds.top
        && event.clientY <= bounds.bottom

      if (pointerInside) {
        if (hoverCloseTimer.current) clearTimeout(hoverCloseTimer.current)
        hoverCloseTimer.current = null
        return
      }

      if (hoverCloseTimer.current) return
      hoverCloseTimer.current = setTimeout(() => {
        setHoverExpanded(false)
        hoverCloseTimer.current = null
      }, RAIL_HOVER_CLOSE_DELAY_MS)
    }

    window.addEventListener('mousemove', trackPointer)
    return () => window.removeEventListener('mousemove', trackPointer)
  }, [hoverExpanded, pinnedExpanded])
  useEffect(() => () => {
    if (hoverOpenTimer.current) clearTimeout(hoverOpenTimer.current)
    if (hoverCloseTimer.current) clearTimeout(hoverCloseTimer.current)
  }, [])
  const togglePinnedExpanded = () => {
    const next = !pinnedExpanded
    setPinnedExpanded(next)
    writeStoredBooleanPreference(APP_STORAGE_KEYS.commandRailExpanded, next)
    if (!next) setHoverExpanded(false)
  }
  const beginResize = (event: React.MouseEvent) => {
    setPinnedExpanded(true)
    writeStoredBooleanPreference(APP_STORAGE_KEYS.commandRailExpanded, true)
    startResizeDrag(event, 'col-resize', (deltaX) => railWidth.resizeBy(-deltaX))
  }
  // Read once per render rather than memoised: the platform does not change,
  // and a stale memo here would be a dent in the wrong place.
  const trafficLightRoom = hasNativeMacosTrafficLights()
  const handleSelect = (destination: CommandRailDestination, action: () => void) => {
    trackRailDestinationClicked(destination)
    action()
  }

  return (
    <div
      ref={railRef}
      className={`relative flex shrink-0 flex-col gap-1 py-2 transition-[width] duration-150 motion-reduce:transition-none ${expanded ? 'items-stretch px-2' : 'items-center'}`}
      data-testid="command-rail"
      data-expanded={expanded ? 'true' : 'false'}
      data-pinned={pinnedExpanded ? 'true' : 'false'}
      onMouseEnter={openFromHover}
      onMouseLeave={cancelPendingHoverOpen}
      style={{
        width: expanded ? railWidth.width : RAIL_COLLAPSED_WIDTH,
        paddingTop: trafficLightRoom ? COMMAND_RAIL_TRAFFIC_LIGHT_INSET : undefined,
        background: 'var(--surface-sidebar)',
        borderRight: '1px solid var(--border-subtle)',
      }}
    >
      {expanded ? (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize Sessions sidebar"
          data-testid="command-rail-resize"
          className="absolute inset-y-0 -right-[10px] z-30 w-4 cursor-col-resize bg-transparent transition-colors hover:bg-[var(--border)]"
          onMouseDown={beginResize}
        />
      ) : null}
      <RailButton
        active={activeDestination === 'chat'}
        expanded={expanded}
        icon={ChatCircle}
        label={t('rail.chat')}
        onClick={() => handleSelect('chat', onSelectChat)}
        testId="command-rail-chat"
      />
      <RailButton
        active={activeDestination === 'inbox'}
        badge={inboxCount}
        expanded={expanded}
        icon={Tray}
        label={t('rail.inbox')}
        onClick={() => handleSelect('inbox', onSelectInbox)}
        testId="command-rail-inbox"
      />
      <RailButton
        active={activeDestination === 'research'}
        expanded={expanded}
        icon={MagnifyingGlass}
        label={t('rail.research')}
        onClick={() => handleSelect('research', onSelectResearch)}
        testId="command-rail-research"
      />
      <RailButton
        active={activeDestination === 'changes'}
        expanded={expanded}
        icon={GitBranch}
        label={t('rail.changes')}
        onClick={() => handleSelect('changes', onSelectChanges)}
        testId="command-rail-changes"
      />

      {/* Conversations sit below the places a person can go — not as a child
          of Chat and not beside the transcript. Compact mode keeps this
          quiet, while the expanded rail gives Sessions the open middle. */}
      <div className="mt-3 min-h-0 flex-1">
        {expanded ? (
          <div
            ref={onSessionsSlotReady}
            data-testid="command-rail-sessions"
            className="h-full min-h-0"
          />
        ) : null}
      </div>

      <div className={expanded ? 'flex items-center justify-end gap-1' : 'flex flex-col items-center gap-1'}>
        <RailButton
          active={false}
          expanded={false}
          icon={GearSix}
          label={t('rail.settings')}
          onClick={onOpenSettings}
          testId="command-rail-settings"
        />
        <ActionTooltip copy={{ label: pinnedExpanded ? 'Unpin sidebar' : 'Pin sidebar' }} side="right">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={togglePinnedExpanded}
            aria-label={pinnedExpanded ? 'Unpin sidebar' : 'Pin sidebar'}
            aria-pressed={pinnedExpanded}
            data-testid="command-rail-toggle"
            className="rounded-[var(--radius)] p-0 hover:bg-[var(--state-hover,var(--accent))]"
            style={{
              width: RAIL_BUTTON_SIZE,
              height: RAIL_BUTTON_SIZE,
              color: pinnedExpanded ? 'var(--accent-blue)' : 'var(--text-muted)',
              backgroundColor: pinnedExpanded ? 'var(--accent-blue-bg)' : undefined,
            }}
          >
            <PushPin size={RAIL_ICON_SIZE} weight={pinnedExpanded ? 'fill' : 'regular'} />
          </Button>
        </ActionTooltip>
      </div>
    </div>
  )
}
