export type CommandGroup = 'Navigation' | 'Note' | 'Git' | 'View' | 'Settings'

export interface CommandAction {
  id: string
  label: string
  group: CommandGroup
  shortcut?: string
  keywords?: string[]
  enabled: boolean
  execute: () => void
}

const GROUP_ORDER: CommandGroup[] = ['Navigation', 'Note', 'Git', 'View', 'Settings']

export function groupSortKey(group: CommandGroup): number {
  return GROUP_ORDER.indexOf(group)
}
