import { memo, useCallback } from 'react'
import type { VaultEntry, SidebarSelection } from '../../types'
import { NoteTitleIcon } from '../NoteTitleIcon'
import { isSelectionActive } from '../SidebarParts'
import { SIDEBAR_ITEM_PADDING } from '../sidebar/sidebarStyles'

interface ProjectEntryRowProps {
  entry: VaultEntry
  selection: SidebarSelection
  onSelect: (selection: SidebarSelection) => void
  depthIndent: number
}

export const ProjectEntryRow = memo(function ProjectEntryRow({
  entry,
  selection,
  onSelect,
  depthIndent,
}: ProjectEntryRowProps) {
  const isActive = isSelectionActive(selection, { kind: 'entity', entry })
  const handleSelect = useCallback(() => {
    onSelect({ kind: 'entity', entry })
  }, [entry, onSelect])

  return (
    <button
      type="button"
      data-testid={`project-entry:${entry.path}`}
      className={`flex w-full cursor-pointer select-none items-center rounded transition-colors ${isActive ? 'bg-accent' : 'hover:bg-accent'}`}
      style={{ padding: SIDEBAR_ITEM_PADDING.regular, paddingLeft: depthIndent, gap: 6 }}
      onClick={handleSelect}
    >
      <NoteTitleIcon icon={entry.icon ?? 'file-text'} size={16} />
      <span className="min-w-0 truncate text-left text-[13px]">{entry.title}</span>
    </button>
  )
})
