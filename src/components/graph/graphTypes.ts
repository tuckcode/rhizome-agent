// TS mirror of the backend GraphDto (src-tauri/src/vault/graph.rs).
// Renderer-agnostic: consumed by the 3D canvas wrapper, the preview
// panel, and the keyboard-nav hook alike.

export type GraphEdgeKind = 'wikilink' | 'belongs_to' | 'related_to' | 'relationship'

export interface WikiGraphNode {
  /** Resolved notes: vault-relative path. Ghosts: `ghost:` + normalized target. */
  id: string
  path: string | null
  title: string
  isA: string | null
  ghost: boolean
  snippet: string
  /** Unix seconds (relativeDate expects seconds, not ms). */
  modifiedAt: number | null
  /** Phosphor icon name from the note's frontmatter, if any. */
  icon: string | null
  linkCount: number
  backlinkCount: number
}

export interface WikiGraphEdge {
  source: string
  target: string
  kind: GraphEdgeKind
  /** Original frontmatter field name when kind === 'relationship'. */
  field: string | null
}

export interface WikiGraphData {
  nodes: WikiGraphNode[]
  edges: WikiGraphEdge[]
}

export type GraphDirection = 'up' | 'down' | 'left' | 'right'

export interface NodeScreenPosition {
  x: number
  y: number
}
