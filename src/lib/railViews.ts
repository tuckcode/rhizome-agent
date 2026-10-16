/**
 * One home for the four peer views. Order is fixed and the same in the
 * command rail, the Go menu, and ⌘K: make knowledge → see knowledge →
 * see what the agent did. Changes sits next to Notes in the sidebar.
 */
export const RAIL_VIEW_IDS = ['research', 'graph', 'mycelium', 'history'] as const

export type RailViewId = (typeof RAIL_VIEW_IDS)[number]

export interface RailViewDefinition {
  id: RailViewId
  /** One noun, used on the rail, in the Go menu, and in ⌘K. */
  label: string
  /** Command-palette / Go-menu label. */
  goLabel: string
  commandId: string
  shortcutNumber: 1 | 2 | 3 | 4
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
    id: 'history',
    label: 'History',
    goLabel: 'Go to History',
    commandId: 'go-pulse',
    shortcutNumber: 4,
    testId: 'command-rail-history',
  },
]

export function railViewById(id: RailViewId): RailViewDefinition {
  const view = RAIL_VIEWS.find((item) => item.id === id)
  if (!view) throw new Error(`Unknown rail view: ${id}`)
  return view
}

export interface ActiveRailViewSelection {
  kind: string
  filter?: string
}

/**
 * Which command-rail View is current. Research, Graph, and Mycelium win
 * in that order when their destination flags are set; Pulse maps to
 * History; anything else is no rail View.
 */
export function computeActiveRailView(
  effectiveSelection: ActiveRailViewSelection,
  isGraphDestination: boolean,
  isMyceliumDestination: boolean,
  isResearchDestination: boolean,
): RailViewId | null {
  if (isResearchDestination) return 'research'
  if (isGraphDestination) return 'graph'
  if (isMyceliumDestination) return 'mycelium'
  if (effectiveSelection.kind === 'filter' && effectiveSelection.filter === 'pulse') {
    return 'history'
  }
  return null
}
