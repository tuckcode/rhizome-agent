import { useMemo } from 'react'
import type { VaultEntry } from '../../types'
import { getTypeColor } from '../../utils/typeColors'
import { getTypeIcon } from '../NoteItem'
import { LinkButton } from './LinkButton'
import { entryStatusTitle } from './shared'

const MAX_DISPLAY = 50

export function InstancesPanel({ entry, entries, typeEntryMap, onNavigate }: {
  entry: VaultEntry
  entries: VaultEntry[]
  typeEntryMap: Record<string, VaultEntry>
  onNavigate: (target: string) => void
}) {
  const instances = useMemo(() => {
    if (entry.isA !== 'Type') return []
    return entries
      .filter((e) => e.isA === entry.title)
      .sort((a, b) => (b.modifiedAt ?? 0) - (a.modifiedAt ?? 0))
  }, [entry, entries])

  if (instances.length === 0) return null

  const displayed = instances.slice(0, MAX_DISPLAY)
  const total = instances.length

  return (
    <div>
      <span className="font-mono-overline mb-1 block text-muted-foreground">
        Instances ({total})
      </span>
      <div className="flex flex-col gap-0.5">
        {displayed.map((e) => {
          const te = typeEntryMap[e.isA ?? '']
          return (
            <LinkButton
              key={e.path}
              label={e.title}
              noteIcon={e.icon}
              typeColor={getTypeColor(e.isA, te?.color)}
              isArchived={e.archived}
              onClick={() => onNavigate(e.title)}
              title={entryStatusTitle(e)}
              TypeIcon={getTypeIcon(e.isA, te?.icon)}
            />
          )
        })}
      </div>
      {total > MAX_DISPLAY && (
        <span className="mt-1 block text-[11px] text-muted-foreground">
          showing {MAX_DISPLAY} of {total}
        </span>
      )}
    </div>
  )
}
