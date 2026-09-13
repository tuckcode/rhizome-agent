import { CaretDown, CaretUp, SidebarSimple } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { translate, type AppLocale } from '../lib/i18n'
import { COMMAND_RAIL_WIDTH_PX } from '../utils/trafficLights'
import { Button } from './ui/button'

interface VaultPanelProps {
  browseOpen: boolean
  locale: AppLocale
  navigation: ReactNode
  noteList: ReactNode
  onBrowseToggle: () => void
  onCollapse: () => void
}

export function VaultPanel({
  browseOpen,
  locale,
  navigation,
  noteList,
  onBrowseToggle,
  onCollapse,
}: VaultPanelProps) {
  const collapseLabel = translate(locale, 'sidebar.action.collapse')
  const browseLabel = translate(
    locale,
    browseOpen ? 'sidebar.action.collapseBrowse' : 'sidebar.action.expandBrowse',
  )

  return (
    <section className="vault-panel" data-testid="vault-panel">
      <header className="vault-panel__header">
        <h2 className="vault-panel__title">{translate(locale, 'rail.notes')}</h2>
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
        {browseOpen ? (
          <div className="vault-panel__navigation" data-testid="vault-panel-navigation">
            {navigation}
          </div>
        ) : null}
        <div className="vault-panel__note-list" data-testid="vault-panel-note-list">
          {noteList}
        </div>
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
        style={{ width: 30, height: 30 }}
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
