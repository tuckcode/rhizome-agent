import { CaretDown, CaretUp, CornersIn, CornersOut, DotsThree, SidebarSimple } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { translate, type AppLocale } from '../lib/i18n'
import { COMMAND_RAIL_WIDTH_PX } from '../utils/trafficLights'
import { ActionTooltip } from './ui/action-tooltip'
import { ResizeHandle } from './ResizeHandle'
import { Button } from './ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'

interface VaultPanelProps {
  browseOpen: boolean
  notesWidth?: number
  browseWidth?: number
  onBrowseResize?: (delta: number) => void
  locale: AppLocale
  navigation: ReactNode
  noteList: ReactNode
  onBrowseToggle: () => void
  onCollapse: () => void
  focused?: boolean
  onFocusToggle?: () => void
}

export function VaultPanel({
  browseOpen,
  notesWidth, browseWidth, onBrowseResize,
  locale,
  navigation,
  noteList,
  onBrowseToggle,
  onCollapse,
  focused = false,
  onFocusToggle,
}: VaultPanelProps) {
  const collapseLabel = translate(locale, 'sidebar.action.collapse')
  const browseLabel = translate(
    locale,
    browseOpen ? 'sidebar.action.collapseBrowse' : 'sidebar.action.expandBrowse',
  )

  const focusLabel = focused ? 'Show Chat' : 'Hide Chat'

  return (
    <section className="vault-panel" data-testid="vault-panel">
      <header className="vault-panel__header">
        <h2 className="vault-panel__title">{translate(locale, 'rail.notes')}</h2>
        <div className="vault-panel__inline-tools" data-testid="vault-panel-inline-tools">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="vault-panel__browse-toggle"
            onClick={onBrowseToggle}
            aria-expanded={browseOpen}
            title={browseLabel}
            aria-label={browseLabel}
            data-testid="vault-panel-browse-toggle"
          >
            {browseOpen ? <CaretUp size={14} /> : <CaretDown size={14} />}
            {translate(locale, 'sidebar.browse')}
          </Button>
          {onFocusToggle ? (
            <ActionTooltip
              copy={{
                label: focused
                  ? 'Show Chat beside Notes'
                  : 'Hide Chat so Notes can fill the window',
              }}
              side="bottom"
            >
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="vault-panel__focus"
                onClick={onFocusToggle}
                aria-pressed={focused}
                aria-label={focusLabel}
                data-testid="vault-panel-focus"
              >
                {focused ? <CornersIn size={16} weight="regular" /> : <CornersOut size={16} weight="regular" />}
              </Button>
            </ActionTooltip>
          ) : null}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="vault-panel__overflow-trigger"
              aria-label="More Notes actions"
              data-testid="vault-panel-overflow-trigger"
            >
              <DotsThree size={16} weight="bold" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onBrowseToggle}>
              {browseOpen ? <CaretUp size={14} /> : <CaretDown size={14} />}
              {browseLabel}
            </DropdownMenuItem>
            {onFocusToggle && (
              <DropdownMenuItem onSelect={onFocusToggle}>
                {focused ? <CornersIn size={16} weight="regular" /> : <CornersOut size={16} weight="regular" />}
                {focusLabel}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="vault-panel__collapse"
          onClick={onCollapse}
          title={collapseLabel}
          aria-label={collapseLabel}
          data-testid="vault-panel-collapse"
        >
          <SidebarSimple size={16} weight="regular" mirrored />
        </Button>
      </header>
      <div className="vault-panel__content">
        <div className="vault-panel__note-list" data-testid="vault-panel-note-list" style={{ width: notesWidth }}>
          {noteList}
        </div>
        {browseOpen ? (
          <div className="vault-panel__navigation" data-testid="vault-panel-navigation" style={{ width: browseWidth }}>
            {onBrowseResize && <ResizeHandle onResize={onBrowseResize} edge="trailing" placement="absolute" label="Resize Browse" testId="browse-panel-resize" />}
            {navigation}
          </div>
        ) : null}
      </div>
    </section>
  )
}

export function VaultPanelRestoreButton({
  onClick,
}: {
  locale: AppLocale
  onClick: () => void
}) {
  const label = 'Show Notes'
  return (
    <div
      className="app__notes-rail"
      style={{
        width: COMMAND_RAIL_WIDTH_PX,
        minWidth: COMMAND_RAIL_WIDTH_PX,
        maxWidth: COMMAND_RAIL_WIDTH_PX,
      }}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="rounded-[var(--radius)] p-0 hover:bg-[var(--state-hover,var(--accent))]"
        style={{ width: 32, height: 32 }}
        onClick={onClick}
        title={label}
        aria-label={label}
        data-testid="vault-panel-restore"
      >
        <SidebarSimple size={16} weight="regular" mirrored />
      </Button>
    </div>
  )
}
