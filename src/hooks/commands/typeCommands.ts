import type { CommandAction } from './types'
import type { SidebarSelection } from '../../types'
import { canonicalizeTypeName } from '../../utils/vaultTypes'

const PLURAL_OVERRIDES: Record<string, string> = {
  Person: 'People',
  Responsibility: 'Responsibilities',
}

export function pluralizeType(type: string): string {
  const override = Reflect.get(PLURAL_OVERRIDES, type) as string | undefined
  if (override) return override
  if (type.endsWith('s') || type.endsWith('x') || type.endsWith('ch') || type.endsWith('sh')) return `${type}es`
  if (type.endsWith('y') && !/[aeiou]y$/i.test(type)) return `${type.slice(0, -1)}ies`
  return `${type}s`
}

export function buildTypeCommands(
  types: string[],
  onCreateNoteOfType: (type: string) => void,
  onSelect: (sel: SidebarSelection) => void,
): CommandAction[] {
  return types.flatMap((type) => {
    const canonicalType = canonicalizeTypeName(type)
    if (!canonicalType) return []

    const slug = canonicalType.toLowerCase().replace(/\s+/g, '-')
    const plural = pluralizeType(canonicalType)
    const commands: CommandAction[] = []

    if (!['note', 'type'].includes(canonicalType.toLowerCase())) {
      commands.push({
        id: `new-${slug}`, label: `New ${canonicalType}`, group: 'Note' as const,
        keywords: ['new', 'create', canonicalType.toLowerCase()],
        enabled: true, execute: () => onCreateNoteOfType(canonicalType),
      })
    }

    commands.push({
      id: `list-${slug}`, label: `List ${plural}`, group: 'Navigation' as const,
      keywords: ['list', 'show', 'filter', canonicalType.toLowerCase(), plural.toLowerCase()],
      enabled: true, execute: () => onSelect({ kind: 'sectionGroup', type: canonicalType }),
    })

    return commands
  })
}
