import { FileText, GitBranch, Tray } from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { getTypeIcon } from '../components/NoteItem'
import type { NoteStatus, SidebarSelection, VaultEntry } from '../types'

export interface NotesRailItem {
  id: string
  label: string
  icon: Icon
  unsaved?: boolean
  active?: boolean
  onSelect: () => void
}

export function notesRailSectionItems({
  showInbox,
  selection,
  onSelect,
}: {
  showInbox: boolean
  selection: SidebarSelection
  onSelect: (selection: SidebarSelection) => void
}): NotesRailItem[] {
  const items: NotesRailItem[] = []
  if (showInbox) {
    items.push({
      id: 'inbox',
      label: 'Inbox',
      icon: Tray,
      active: selection.kind === 'filter' && selection.filter === 'inbox',
      onSelect: () => onSelect({ kind: 'filter', filter: 'inbox' }),
    })
  }
  items.push({
    id: 'all',
    label: 'All Notes',
    icon: FileText,
    active: selection.kind === 'filter' && selection.filter === 'all',
    onSelect: () => onSelect({ kind: 'filter', filter: 'all' }),
  })
  items.push({
    id: 'changes',
    label: 'Changes',
    icon: GitBranch,
    active: selection.kind === 'filter' && selection.filter === 'changes',
    onSelect: () => onSelect({ kind: 'filter', filter: 'changes' }),
  })
  return items
}

export function notesRailRecentItems({
  entries,
  getNoteStatus,
  onSelectNote,
  limit = 5,
}: {
  entries: readonly VaultEntry[]
  getNoteStatus?: (path: string) => NoteStatus
  onSelectNote?: (entry: VaultEntry) => void
  limit?: number
}): NotesRailItem[] {
  if (!onSelectNote) return []
  return [...entries]
    .filter((entry) => !entry.archived && entry.fileKind !== 'binary')
    .sort((left, right) => (right.modifiedAt ?? 0) - (left.modifiedAt ?? 0))
    .slice(0, limit)
    .map((entry) => {
      const status = getNoteStatus?.(entry.path)
      return {
        id: `note:${entry.path}`,
        label: entry.title || entry.filename || entry.path,
        icon: getTypeIcon(entry.isA, entry.icon) as Icon,
        unsaved: status === 'unsaved' || status === 'pendingSave',
        onSelect: () => onSelectNote(entry),
      }
    })
}
