import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CirclesThree,
  ClockCounterClockwise,
  GearSix,
  GitDiff,
  Graph,
  MagnifyingGlassPlus,
  Sidebar,
} from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { ActionTooltip } from './ui/action-tooltip'
import { Button } from './ui/button'
import { createTranslator, type AppLocale } from '../lib/i18n'
import { APP_STORAGE_KEYS } from '../constants/appStorage'
import { readStoredBooleanPreference, writeStoredBooleanPreference } from '../lib/uiPreference'
import { usePanelWidth } from '../hooks/usePanelWidth'
import { trackRailViewSelected, trackSessionsDrawerOpened } from '../lib/productAnalytics'
import { RAIL_VIEWS, type RailViewId } from '../lib/railViews'
import { startResizeDrag } from '../utils/startResizeDrag'
import { COMMAND_RAIL_EXPANDED_WIDTH_PX } from '../utils/trafficLights'
import {
  railButtonAccessibleName,
  railViewShortcutAria,
  railViewShortcutDisplay,
} from '../lib/railViewShortcuts'

interface CommandRailProps {
  locale: AppLocale
  pinned?: boolean
  autoCollapsed?: boolean
  onPinnedChange?: (pinned: boolean) => void
  width?: number
  onWidthChange?: (delta: number) => void
  onOpenSettings: () => void
  onSelectView: (view: RailViewId) => void
  activeView?: RailViewId | null
  changeCount?: number
  /** Expanded rail's open middle, where Chat mounts its session list. */
  onSessionsSlotReady?: (slot: HTMLDivElement | null) => void
  /** Current layout width. Collapsed is 46. Open, including hover, is the wide rail. */
  onLayoutWidthChange?: (width: number) => void
  /**
   * The shell cannot give an open rail its own column. Expand then opens a
   * temporary drawer over Chat behind a scrim (native audit 2026-09-26).
   */
  drawer?: boolean
  /** Bump to close an open drawer — the shell does this after a session is picked. */
  drawerCloseSignal?: number
}

const VIEW_ICONS: Record<RailViewId, Icon> = {
  research: MagnifyingGlassPlus,
  graph: Graph,
  mycelium: CirclesThree,
  changes: GitDiff,
  history: ClockCounterClockwise,
}

const RAIL_BUTTON_SIZE = 30
const RAIL_ICON_SIZE = 16
const RAIL_COLLAPSED_WIDTH = 46
const RAIL_EXPANDED_DEFAULT_WIDTH = COMMAND_RAIL_EXPANDED_WIDTH_PX
const RAIL_EXPANDED_MIN_WIDTH = 180
const RAIL_EXPANDED_MAX_WIDTH = 360
const RAIL_HOVER_OPEN_DELAY_MS = 150
const RAIL_HOVER_CLOSE_DELAY_MS = 180
/**
 * Room for the macOS traffic lights, in both rail states.
 *
 * `tauri.conf.json` puts them at the left corner (x=14, y=16) — standard
 * macOS chrome. Both collapsed (46px) and expanded (240px) rails sit under
 * them, so content starts below the lights the way it does in every macOS
 * sidebar. Off-Mac there are no lights to make room for, and the space would
 * just be a dent in the top of the rail.
 */
function RailButton({
  active,
  badge,
  expanded,
  icon: IconComponent,
  iconOnly = false,
  label,
  onClick,
  shortcut,
  shortcutAria,
  testId,
}: {
  active: boolean
  badge?: number
  expanded: boolean
  icon: Icon
  iconOnly?: boolean
  label: string
  onClick: () => void
  shortcut?: string
  shortcutAria?: string
  testId: string
}) {
  const showLabel = expanded && !iconOnly
  const button = (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={onClick}
      aria-label={railButtonAccessibleName(label, badge)}
      aria-current={active ? 'page' : undefined}
      aria-keyshortcuts={shortcutAria}
      data-testid={testId}
      className={
        showLabel
          ? `relative flex w-full items-center justify-start gap-2 rounded-[var(--radius)] px-2 ${
              active ? '' : 'hover:bg-[var(--state-hover,var(--accent))]'
            }`
          : `relative shrink-0 rounded-[var(--radius)] p-0 ${
              active ? '' : 'hover:bg-[var(--state-hover,var(--accent))]'
            }`
      }
      style={{
        width: showLabel ? '100%' : RAIL_BUTTON_SIZE,
        height: RAIL_BUTTON_SIZE,
        color: active ? 'var(--foreground)' : 'var(--text-muted)',
        backgroundColor: active ? 'var(--state-selected)' : undefined,
        boxShadow: active ? 'inset 2px 0 0 var(--accent-blue)' : undefined,
      }}
    >
      <IconComponent size={RAIL_ICON_SIZE} weight={active ? 'fill' : 'regular'} />
      {showLabel ? <span className="truncate text-[13px] leading-none">{label}</span> : null}
      {badge && badge > 0 ? (
        <span
          className={expanded
            ? 'ml-auto min-w-[18px] rounded-full bg-muted px-1.5 text-center text-[10px] leading-[18px] text-muted-foreground'
            : 'absolute right-0 top-0 min-w-[14px] rounded-full bg-muted px-1 text-center text-[9px] leading-[14px] text-muted-foreground'}
          aria-hidden="true"
        >
          {badge > 99 ? '99+' : badge}
        </span>
      ) : null}
      {showLabel && shortcut ? (
        <span className={`${badge && badge > 0 ? 'ml-1' : 'ml-auto'} shrink-0 font-mono text-[10px] text-muted-foreground`}>
          {shortcut}
        </span>
      ) : null}
    </Button>
  )

  // A tooltip that repeats a label already on screen is noise, and it steals
  // the pointer from a target the user can already read. The Settings gear is
  // icon-only in both rail widths, so it keeps the tooltip.
  return showLabel ? button : (
    <ActionTooltip copy={{ label, shortcut }} side="right">
      {button}
    </ActionTooltip>
  )
}

/**
 * Sessions rail — behind `shell_command_rail`. The Views group is the home
 * for Research, Graph, Mycelium, Changes, and History. Settings and the
 * sidebar control live in the footer.
 */
export function CommandRail({
  locale,
  pinned, autoCollapsed = false, onPinnedChange, width, onWidthChange,
  onOpenSettings,
  onSelectView,
  activeView = null,
  changeCount = 0,
  onSessionsSlotReady,
  onLayoutWidthChange,
  drawer = false,
  drawerCloseSignal,
}: CommandRailProps) {
  const t = createTranslator(locale)
  const [storedPinned, setPinnedExpanded] = useState(() =>
    readStoredBooleanPreference(APP_STORAGE_KEYS.commandRailExpanded, true),
  )
  const [compactLocked, setCompactLocked] = useState(() =>
    readStoredBooleanPreference(APP_STORAGE_KEYS.commandRailCompactLocked, false),
  )
  const pinRequested = pinned ?? storedPinned
  const pinnedExpanded = pinRequested && !autoCollapsed && !compactLocked
  const [hoverExpanded, setHoverExpanded] = useState(false)
  const [keyboardExpanded, setKeyboardExpanded] = useState(false)
  // Close a hover/keyboard-open rail when the shell auto-collapses it.
  // Adjusted during render, not in an effect, to avoid a cascading render.
  const [prevAutoCollapsed, setPrevAutoCollapsed] = useState(autoCollapsed)
  if (autoCollapsed !== prevAutoCollapsed) {
    setPrevAutoCollapsed(autoCollapsed)
    if (autoCollapsed) {
      setHoverExpanded(false)
      setKeyboardExpanded(false)
    }
  }
  const [prevDrawerCloseSignal, setPrevDrawerCloseSignal] = useState(drawerCloseSignal)
  if (drawerCloseSignal !== prevDrawerCloseSignal) {
    setPrevDrawerCloseSignal(drawerCloseSignal)
    if (drawer) {
      setHoverExpanded(false)
      setKeyboardExpanded(false)
    }
  }
  const railWidth = usePanelWidth(
    APP_STORAGE_KEYS.commandRailWidth,
    RAIL_EXPANDED_DEFAULT_WIDTH,
    RAIL_EXPANDED_MIN_WIDTH,
    RAIL_EXPANDED_MAX_WIDTH,
  )
  const railRef = useRef<HTMLDivElement>(null)
  const sessionsSlotRef = useRef<HTMLDivElement | null>(null)
  const onSessionsSlotReadyRef = useRef(onSessionsSlotReady)
  useEffect(() => {
    onSessionsSlotReadyRef.current = onSessionsSlotReady
  }, [onSessionsSlotReady])
  const suppressHoverRef = useRef(false)
  const hoverOpenTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hoverCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bindSessionsSlot = useCallback((slot: HTMLDivElement | null) => {
    sessionsSlotRef.current = slot
    onSessionsSlotReadyRef.current?.(slot)
  }, [])
  const expanded = pinnedExpanded || hoverExpanded || keyboardExpanded
  // Expansion takes layout width, so Chat shifts instead of sliding under the rail.
  const overlaying = false
  // ...unless the shell has no room: then it is a drawer with a scrim.
  const drawerOpen = drawer && expanded && !pinnedExpanded
  const openFromHover = () => {
    if (hoverCloseTimer.current) clearTimeout(hoverCloseTimer.current)
    hoverCloseTimer.current = null
    if (
      autoCollapsed
      || drawer
      || suppressHoverRef.current
      || compactLocked
      || pinnedExpanded
      || hoverExpanded
      || keyboardExpanded
      || hoverOpenTimer.current
    ) return
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
      const rail = railRef.current
      const bounds = rail?.getBoundingClientRect()
      const overCollapsedStrip = Boolean(
        bounds
        && event.clientX >= bounds.left
        && event.clientX <= bounds.left + RAIL_COLLAPSED_WIDTH
        && event.clientY >= bounds.top
        && event.clientY <= bounds.bottom,
      )
      const overRailChrome = Boolean(event.target instanceof Node && rail?.contains(event.target))
      const focusHeld = Boolean(
        document.activeElement instanceof Node && rail?.contains(document.activeElement),
      )
      const pointerInside = overCollapsedStrip || overRailChrome || focusHeld

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
  useEffect(() => {
    if (!keyboardExpanded) return
    let frames = 0
    let raf = 0
    let cancelled = false
    const focusSessions = () => {
      if (cancelled) return
      const focusable = sessionsSlotRef.current?.querySelector<HTMLElement>(
        'button, input, textarea, [href], [tabindex]:not([tabindex="-1"])',
      )
      if (focusable) {
        focusable.focus()
        return
      }
      frames += 1
      if (frames < 12) raf = requestAnimationFrame(focusSessions)
    }
    focusSessions()
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
    }
  }, [keyboardExpanded])
  useEffect(() => {
    if (autoCollapsed) suppressHoverRef.current = true
  }, [autoCollapsed])
  const layoutWidth = expanded && !drawerOpen ? (width ?? railWidth.width) : RAIL_COLLAPSED_WIDTH
  useEffect(() => {
    onLayoutWidthChange?.(layoutWidth)
  }, [layoutWidth, onLayoutWidthChange])
  const writeExpandedPin = (next: boolean) => {
    setPinnedExpanded(next)
    onPinnedChange?.(next)
    writeStoredBooleanPreference(APP_STORAGE_KEYS.commandRailExpanded, next)
  }
  const writeCompactLock = (next: boolean) => {
    setCompactLocked(next)
    writeStoredBooleanPreference(APP_STORAGE_KEYS.commandRailCompactLocked, next)
  }
  const toggleKeyboardExpand = () => {
    cancelPendingHoverOpen()
    setKeyboardExpanded((open) => {
      if (open) {
        setHoverExpanded(false)
        return false
      }
      return true
    })
  }
  const collapseRail = () => {
    suppressHoverRef.current = true
    cancelPendingHoverOpen()
    setHoverExpanded(false)
    setKeyboardExpanded(false)
    if (pinRequested) writeExpandedPin(false)
  }
  // Closing a drawer never touches the saved pin: the pin is a wide-window choice.
  const closeDrawer = useCallback(() => {
    if (hoverOpenTimer.current) clearTimeout(hoverOpenTimer.current)
    hoverOpenTimer.current = null
    setHoverExpanded(false)
    setKeyboardExpanded(false)
  }, [])
  useEffect(() => {
    if (!drawerOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeDrawer()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [drawerOpen, closeDrawer])
  const onSidebarClick = () => {
    if (drawerOpen) return closeDrawer()
    if (expanded) return collapseRail()
    if (drawer) trackSessionsDrawerOpened()
    toggleKeyboardExpand()
  }
  const beginResize = (event: React.MouseEvent) => {
    writeCompactLock(false)
    writeExpandedPin(true)
    setKeyboardExpanded(false)
    startResizeDrag(event, 'col-resize', (deltaX) => onWidthChange ? onWidthChange(deltaX) : railWidth.resizeBy(-deltaX))
  }
  const settingsButton = (
    <RailButton
      active={false}
      expanded={expanded}
      icon={GearSix}
      iconOnly
      label={t('rail.settings')}
      onClick={onOpenSettings}
      testId="command-rail-settings"
    />
  )
  const expandLabel = expanded ? 'Collapse sidebar' : 'Expand sidebar'
  const expandButton = (
    <ActionTooltip copy={{ label: expandLabel }} side="right">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={onSidebarClick}
        aria-label={expandLabel}
        aria-expanded={expanded}
        data-testid="command-rail-expand"
        className="rounded-[var(--radius)] p-0 hover:bg-[var(--state-hover,var(--accent))]"
        style={{
          width: RAIL_BUTTON_SIZE,
          height: RAIL_BUTTON_SIZE,
          color: expanded ? 'var(--accent-blue)' : 'var(--text-muted)',
          backgroundColor: expanded ? 'var(--accent-blue-bg)' : undefined,
        }}
      >
        <Sidebar size={RAIL_ICON_SIZE} weight={expanded ? 'fill' : 'regular'} />
      </Button>
    </ActionTooltip>
  )
  return (
    <>
    {drawerOpen ? (
      <div
        aria-hidden="true"
        data-testid="command-rail-drawer-scrim"
        className="fixed inset-0 z-[49] bg-black/30 motion-safe:animate-in motion-safe:fade-in-0"
        onClick={closeDrawer}
      />
    ) : null}
    <div
      ref={railRef}
      className={`relative flex shrink-0 flex-col gap-1 py-2 transition-[width] duration-150 motion-reduce:transition-none ${expanded ? 'items-stretch px-2' : 'items-center'}`}
      data-testid="command-rail"
      data-expanded={expanded ? 'true' : 'false'}
      data-pinned={pinnedExpanded ? 'true' : 'false'}
      data-compact-locked={compactLocked ? 'true' : 'false'}
      data-overlay={overlaying ? 'true' : 'false'}
      data-drawer={drawerOpen ? 'true' : 'false'}
      onMouseEnter={(event) => {
        const footer = event.currentTarget.querySelector('[data-testid="command-rail-footer"]')
        if (footer instanceof Element && event.target instanceof Node && footer.contains(event.target)) {
          cancelPendingHoverOpen()
          return
        }
        openFromHover()
      }}
      onMouseLeave={() => {
        suppressHoverRef.current = false
        cancelPendingHoverOpen()
      }}
      style={{
        width: expanded ? (width ?? railWidth.width) : RAIL_COLLAPSED_WIDTH,
        marginRight: overlaying || drawerOpen ? -((width ?? railWidth.width) - RAIL_COLLAPSED_WIDTH) : undefined,
        zIndex: overlaying || drawerOpen ? 50 : undefined,
        boxShadow: drawerOpen ? 'var(--shadow-lg, 0 10px 30px rgb(0 0 0 / 0.25))' : undefined,
        pointerEvents: overlaying ? 'none' : undefined,
        background: 'var(--surface-sidebar)',
        borderRight: '1px solid var(--border-subtle)',
      }}
    >
      {overlaying ? (
        <div
          aria-hidden="true"
          data-testid="command-rail-hover-hit"
          className="absolute inset-y-0 left-0 z-0"
          style={{ width: RAIL_COLLAPSED_WIDTH, pointerEvents: 'auto' }}
        />
      ) : null}

      {expanded ? (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize Sessions sidebar"
          data-testid="command-rail-resize"
          className="absolute inset-y-0 -right-[10px] z-30 w-4 cursor-col-resize bg-transparent transition-colors hover:bg-[var(--border)]"
          style={{ pointerEvents: overlaying ? 'auto' : undefined }}
          onMouseDown={beginResize}
        />
      ) : null}

      {/* Sessions fill the open middle. Views stay visible in both rail widths. */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {expanded ? (
          <div
            ref={bindSessionsSlot}
            data-testid="command-rail-sessions"
            className="h-full min-h-0"
            style={{ pointerEvents: overlaying ? 'none' : undefined }}
          />
        ) : null}
      </div>

      <div
        role="group"
        aria-label="Views"
        data-testid="command-rail-views"
        className={expanded ? 'flex flex-col items-stretch gap-0.5 pt-1' : 'flex flex-col items-center gap-0.5'}
        style={{ pointerEvents: overlaying ? 'auto' : undefined }}
      >
        {expanded ? (
          <div
            className="px-2 pb-1 text-[11px] font-medium text-muted-foreground"
            data-testid="command-rail-views-heading"
          >
            Views
          </div>
        ) : null}
        {RAIL_VIEWS.map((view) => (
          <RailButton
            key={view.id}
            active={activeView === view.id}
            badge={view.id === 'changes' ? changeCount : undefined}
            expanded={expanded}
            icon={VIEW_ICONS[view.id]}
            label={view.label}
            shortcut={railViewShortcutDisplay(view.shortcutNumber)}
            shortcutAria={railViewShortcutAria(view.shortcutNumber)}
            onClick={() => {
              trackRailViewSelected(view.id)
              onSelectView(view.id)
            }}
            testId={view.testId}
          />
        ))}
      </div>

      <div
        className={`relative z-10 ${expanded ? 'flex items-center gap-1' : 'flex flex-col items-center gap-1'}`}
        data-testid="command-rail-footer"
        style={{ pointerEvents: overlaying ? 'auto' : undefined }}
        onMouseEnter={cancelPendingHoverOpen}
      >
        {expanded ? (
          <>
            {expandButton}
            <span className="ml-auto">{settingsButton}</span>
          </>
        ) : (
          <>
            {expandButton}
            {settingsButton}
          </>
        )}
      </div>
    </div>
    </>
  )
}
