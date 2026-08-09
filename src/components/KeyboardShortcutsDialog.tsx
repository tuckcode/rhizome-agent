import { useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  APP_COMMAND_DEFINITIONS,
  formatShortcutDisplay,
} from '../hooks/appCommandCatalog'
import { createTranslator, type AppLocale, type TranslationKey } from '../lib/i18n'

interface KeyboardShortcutsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  locale?: AppLocale
}

interface ShortcutRow {
  id: string
  label: string
  shortcut: string
  group: string
}

const GROUP_ORDER = ['File', 'Edit', 'View', 'Go', 'Note', 'Vault', 'Search'] as const

const LABEL_OVERRIDES: Record<string, string> = {
  'file-new-note': 'New note',
  'file-quick-open': 'Quick open',
  'file-save': 'Save',
  'edit-find-in-note': 'Find in note',
  'edit-find-in-vault': 'Find in vault',
  'edit-undo': 'Undo',
  'edit-redo': 'Redo',
  'edit-paste-plain-text': 'Paste without formatting',
  'edit-toggle-raw-editor': 'Toggle raw editor',
  'view-command-palette': 'Command palette',
  'view-keyboard-shortcuts': 'Keyboard shortcuts',
  'view-editor-only': 'Editor only',
  'view-editor-list': 'Editor + notes',
  'view-all': 'All panels',
  'view-toggle-properties': 'Toggle properties',
  'view-toggle-ai-chat': 'Toggle AI panel',
  'view-toggle-table-of-contents': 'Toggle table of contents',
  'view-zoom-in': 'Zoom in',
  'view-zoom-out': 'Zoom out',
  'view-zoom-reset': 'Actual size',
  'view-go-back': 'Go back',
  'view-go-forward': 'Go forward',
  'note-toggle-favorite': 'Toggle favorite',
  'note-toggle-organized': 'Toggle organized',
  'note-delete': 'Delete note',
  'note-open-in-new-window': 'Open in new window',
  'vault-reload': 'Reload vault',
  'app-settings': 'Settings',
}

function groupForCommandId(id: string): string {
  if (id.startsWith('file-') || id === 'app-settings') return id === 'app-settings' ? 'Edit' : 'File'
  if (id.startsWith('edit-')) return 'Edit'
  if (id.startsWith('view-')) {
    if (id.includes('go-')) return 'Go'
    if (id.includes('command') || id.includes('keyboard')) return 'Search'
    return 'View'
  }
  if (id.startsWith('note-')) return 'Note'
  if (id.startsWith('vault-')) return 'Vault'
  if (id.includes('find') || id.includes('search') || id.includes('quick') || id.includes('palette')) {
    return 'Search'
  }
  return 'View'
}

function groupLabelKey(group: string): TranslationKey {
  switch (group) {
    case 'File':
      return 'shortcuts.group.file'
    case 'Edit':
      return 'shortcuts.group.edit'
    case 'View':
      return 'shortcuts.group.view'
    case 'Note':
      return 'shortcuts.group.note'
    case 'Vault':
      return 'shortcuts.group.vault'
    case 'Go':
      return 'shortcuts.group.go'
    case 'Search':
      return 'shortcuts.group.search'
    default:
      return 'shortcuts.group.view'
  }
}

function collectShortcutRows(): ShortcutRow[] {
  const rows: ShortcutRow[] = []
  for (const [id, definition] of Object.entries(APP_COMMAND_DEFINITIONS)) {
    const shortcut = definition.shortcut
    if (!shortcut) continue
    rows.push({
      id,
      label: LABEL_OVERRIDES[id] ?? id.replace(/-/g, ' '),
      shortcut: formatShortcutDisplay(shortcut),
      group: groupForCommandId(id),
    })
  }
  const order = new Map(GROUP_ORDER.map((g, i) => [g, i]))
  rows.sort((a, b) => {
    const ga = order.get(a.group as (typeof GROUP_ORDER)[number]) ?? 99
    const gb = order.get(b.group as (typeof GROUP_ORDER)[number]) ?? 99
    if (ga !== gb) return ga - gb
    return a.label.localeCompare(b.label)
  })
  return rows
}

export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
  locale = 'en',
}: KeyboardShortcutsDialogProps) {
  const t = createTranslator(locale)
  const rows = useMemo(() => collectShortcutRows(), [])
  const groups = useMemo(() => {
    const map = new Map<string, ShortcutRow[]>()
    for (const row of rows) {
      const list = map.get(row.group) ?? []
      list.push(row)
      map.set(row.group, list)
    }
    return GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({
      group: g,
      items: map.get(g)!,
    }))
  }, [rows])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[min(80dvh,640px)] max-w-lg flex-col gap-0 overflow-hidden p-0"
        data-testid="keyboard-shortcuts-dialog"
      >
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle>{t('shortcuts.title')}</DialogTitle>
          <DialogDescription>{t('shortcuts.description')}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-5">
            {groups.map(({ group, items }) => (
              <section key={group}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t(groupLabelKey(group))}
                </h3>
                <ul className="space-y-1.5">
                  {items.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-4 text-sm"
                    >
                      <span className="min-w-0 truncate text-foreground">{item.label}</span>
                      <kbd className="shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                        {item.shortcut}
                      </kbd>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
