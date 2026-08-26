import { useState } from 'react'
import { CaretLeft, CaretRight, ChatCircle, CirclesThree, GearSix, GitBranch, MagnifyingGlass, ShareNetwork, Tray } from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { ActionTooltip } from './ui/action-tooltip'
import { Button } from './ui/button'
import { createTranslator, type AppLocale } from '../lib/i18n'
import { trackRailDestinationClicked } from '../lib/productAnalytics'
import { APP_STORAGE_KEYS } from '../constants/appStorage'
import { readStoredBooleanPreference, writeStoredBooleanPreference } from '../lib/uiPreference'
import {
  COMMAND_RAIL_TRAFFIC_LIGHT_INSET,
  hasNativeMacosTrafficLights,
} from '../utils/trafficLights'

export type CommandRailDestination = 'chat' | 'inbox' | 'graph' | 'mycelium' | 'research' | 'changes'

interface CommandRailProps {
  locale: AppLocale
  activeDestination: CommandRailDestination
  inboxCount?: number
  onSelectChat: () => void
  onSelectInbox: () => void
  onSelectGraph: () => void
  onSelectMycelium: () => void
  onOpenResearch: () => void
  onSelectChanges: () => void
  onOpenSettings: () => void
}

const RAIL_BUTTON_SIZE = 30
const RAIL_ICON_SIZE = 16
const RAIL_COLLAPSED_WIDTH = 46
const RAIL_EXPANDED_WIDTH = 168
/**
 * Room for the macOS traffic lights, in both rail states.
 *
 * `tauri.conf.json` puts them at x=58, y=16. Expanded, the 168px rail runs
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
          ? 'relative flex w-full items-center justify-start gap-2 rounded-[var(--radius)] px-2'
          : 'relative rounded-[var(--radius)] p-0'
      }
      style={{
        width: expanded ? '100%' : RAIL_BUTTON_SIZE,
        height: RAIL_BUTTON_SIZE,
        color: active ? 'var(--accent-blue)' : 'var(--text-muted)',
        backgroundColor: active ? 'var(--accent-blue-bg)' : 'transparent',
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
 * already call (same Graph toggle history semantics, same Research dialog,
 * same Changes filter) so behavior is identical, only the entry point moves.
 */
export function CommandRail({
  locale,
  activeDestination,
  inboxCount = 0,
  onSelectChat,
  onSelectInbox,
  onSelectGraph,
  onSelectMycelium,
  onOpenResearch,
  onSelectChanges,
  onOpenSettings,
}: CommandRailProps) {
  const t = createTranslator(locale)
  const [expanded, setExpanded] = useState(() =>
    readStoredBooleanPreference(APP_STORAGE_KEYS.commandRailExpanded, true),
  )
  const toggleExpanded = () => {
    setExpanded((open) => {
      const next = !open
      writeStoredBooleanPreference(APP_STORAGE_KEYS.commandRailExpanded, next)
      return next
    })
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
      className={`flex shrink-0 flex-col gap-1 py-2 ${expanded ? 'items-stretch px-2' : 'items-center'}`}
      data-testid="command-rail"
      data-expanded={expanded ? 'true' : 'false'}
      style={{
        width: expanded ? RAIL_EXPANDED_WIDTH : RAIL_COLLAPSED_WIDTH,
        paddingTop: trafficLightRoom ? COMMAND_RAIL_TRAFFIC_LIGHT_INSET : undefined,
        background: 'var(--surface-sidebar)',
        borderRight: '1px solid var(--border-subtle)',
      }}
    >
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
        active={activeDestination === 'graph'}
        expanded={expanded}
        icon={ShareNetwork}
        label={t('rail.graph')}
        onClick={() => handleSelect('graph', onSelectGraph)}
        testId="command-rail-graph"
      />
      <RailButton
        active={activeDestination === 'mycelium'}
        expanded={expanded}
        icon={CirclesThree}
        label={t('rail.mycelium')}
        onClick={() => handleSelect('mycelium', onSelectMycelium)}
        testId="command-rail-mycelium"
      />
      <RailButton
        active={activeDestination === 'research'}
        expanded={expanded}
        icon={MagnifyingGlass}
        label={t('rail.research')}
        onClick={() => handleSelect('research', onOpenResearch)}
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

      <div className="flex-1" />

      <RailButton
        active={false}
        expanded={expanded}
        icon={expanded ? CaretLeft : CaretRight}
        label={t(expanded ? 'rail.collapse' : 'rail.expand')}
        onClick={toggleExpanded}
        testId="command-rail-toggle"
      />

      <RailButton
        active={false}
        expanded={expanded}
        icon={GearSix}
        label={t('rail.settings')}
        onClick={onOpenSettings}
        testId="command-rail-settings"
      />
    </div>
  )
}
