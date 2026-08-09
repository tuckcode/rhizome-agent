import { CirclesThree, GearSix, GitBranch, ListBullets, MagnifyingGlass, ShareNetwork } from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { ActionTooltip } from './ui/action-tooltip'
import { Button } from './ui/button'
import { createTranslator, type AppLocale } from '../lib/i18n'
import { trackRailDestinationClicked } from '../lib/productAnalytics'

export type CommandRailDestination = 'notes' | 'graph' | 'mycelium' | 'research' | 'changes'

interface CommandRailProps {
  locale: AppLocale
  activeDestination: CommandRailDestination
  onSelectNotes: () => void
  onSelectGraph: () => void
  onSelectMycelium: () => void
  onOpenResearch: () => void
  onSelectChanges: () => void
  onOpenSettings: () => void
}

const RAIL_BUTTON_SIZE = 30
const RAIL_ICON_SIZE = 16

function RailButton({
  active,
  icon: IconComponent,
  label,
  onClick,
  testId,
}: {
  active: boolean
  icon: Icon
  label: string
  onClick: () => void
  testId: string
}) {
  return (
    <ActionTooltip copy={{ label }} side="right">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={onClick}
        aria-label={label}
        aria-pressed={active}
        data-testid={testId}
        className="rounded-[var(--radius)] p-0"
        style={{
          width: RAIL_BUTTON_SIZE,
          height: RAIL_BUTTON_SIZE,
          color: active ? 'var(--accent-blue)' : 'var(--text-muted)',
          backgroundColor: active ? 'var(--accent-blue-bg)' : 'transparent',
        }}
      >
        <IconComponent size={RAIL_ICON_SIZE} weight={active ? 'fill' : 'regular'} />
      </Button>
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
  onSelectNotes,
  onSelectGraph,
  onSelectMycelium,
  onOpenResearch,
  onSelectChanges,
  onOpenSettings,
}: CommandRailProps) {
  const t = createTranslator(locale)
  const handleSelect = (destination: CommandRailDestination, action: () => void) => {
    trackRailDestinationClicked(destination)
    action()
  }

  return (
    <div
      className="flex shrink-0 flex-col items-center gap-1 py-2"
      data-testid="command-rail"
      style={{
        width: 46,
        // No traffic-light offset needed: tauri.conf.json positions them at
        // x=58, clear of this 46px rail, so they sit in the sidebar's top band
        // instead of straddling the rail/sidebar divider.

        background: 'var(--surface-sidebar)',
        borderRight: '1px solid var(--border-subtle)',
      }}
    >
      <RailButton
        active={activeDestination === 'notes'}
        icon={ListBullets}
        label={t('rail.notes')}
        onClick={() => handleSelect('notes', onSelectNotes)}
        testId="command-rail-notes"
      />
      <RailButton
        active={activeDestination === 'graph'}
        icon={ShareNetwork}
        label={t('rail.graph')}
        onClick={() => handleSelect('graph', onSelectGraph)}
        testId="command-rail-graph"
      />
      <RailButton
        active={activeDestination === 'mycelium'}
        icon={CirclesThree}
        label={t('rail.mycelium')}
        onClick={() => handleSelect('mycelium', onSelectMycelium)}
        testId="command-rail-mycelium"
      />
      <RailButton
        active={activeDestination === 'research'}
        icon={MagnifyingGlass}
        label={t('rail.research')}
        onClick={() => handleSelect('research', onOpenResearch)}
        testId="command-rail-research"
      />
      <RailButton
        active={activeDestination === 'changes'}
        icon={GitBranch}
        label={t('rail.changes')}
        onClick={() => handleSelect('changes', onSelectChanges)}
        testId="command-rail-changes"
      />

      <div className="flex-1" />

      <RailButton
        active={false}
        icon={GearSix}
        label={t('rail.settings')}
        onClick={onOpenSettings}
        testId="command-rail-settings"
      />
    </div>
  )
}
