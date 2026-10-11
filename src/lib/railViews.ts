/**
 * One home for the five peer views. Order is fixed and the same in the
 * command rail, the Go menu, and ⌘K: make knowledge → see knowledge →
 * see what the agent did → see what changed.
 */
export const RAIL_VIEW_IDS = ['research', 'graph', 'mycelium', 'changes', 'history'] as const

export type RailViewId = (typeof RAIL_VIEW_IDS)[number]

export interface RailViewDefinition {
  id: RailViewId
  /** One noun, used on the rail, in the Go menu, and in ⌘K. */
  label: string
  /** Command-palette / Go-menu label. */
  goLabel: string
  commandId: string
  shortcutNumber: 1 | 2 | 3 | 4 | 5
  testId: string
}

export const RAIL_VIEWS: readonly RailViewDefinition[] = [
  {
    id: 'research',
    label: 'Research',
    goLabel: 'Go to Research',
    commandId: 'go-research',
    shortcutNumber: 1,
    testId: 'command-rail-research',
  },
  {
    id: 'graph',
    label: 'Graph',
    goLabel: 'Go to Graph',
    commandId: 'go-graph',
    shortcutNumber: 2,
    testId: 'command-rail-graph',
  },
  {
    id: 'mycelium',
    label: 'Mycelium',
    goLabel: 'Go to Mycelium',
    commandId: 'go-mycelium',
    shortcutNumber: 3,
    testId: 'command-rail-mycelium',
  },
  {
    id: 'changes',
    label: 'Changes',
    goLabel: 'Go to Changes',
    commandId: 'go-changes',
    shortcutNumber: 4,
    testId: 'command-rail-changes',
  },
  {
    id: 'history',
    label: 'History',
    goLabel: 'Go to History',
    commandId: 'go-pulse',
    shortcutNumber: 5,
    testId: 'command-rail-history',
  },
]

export function railViewById(id: RailViewId): RailViewDefinition {
  const view = RAIL_VIEWS.find((item) => item.id === id)
  if (!view) throw new Error(`Unknown rail view: ${id}`)
  return view
}
