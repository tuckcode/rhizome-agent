// Pure helpers over WikiGraphData — no WebGL, no React. Everything the
// GraphView needs that isn't rendering lives here so it stays fully
// unit-testable in jsdom.

import type {
  GraphDirection,
  NodeScreenPosition,
  WikiGraphData,
  WikiGraphNode,
} from './graphTypes'

/** Parse the backend's JSON payload, validating the top-level shape. */
export function parseGraphResponse(json: string): WikiGraphData {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('Invalid graph payload: not JSON')
  }
  const candidate = parsed as { nodes?: unknown; edges?: unknown }
  if (!Array.isArray(candidate.nodes) || !Array.isArray(candidate.edges)) {
    throw new Error('Invalid graph payload: missing nodes/edges arrays')
  }
  return candidate as unknown as WikiGraphData
}

export interface GraphFilter {
  /** Case-insensitive substring match against node titles. Empty = no filter. */
  query: string
  /** Node types to exclude. A node's type is `isA ?? ''`. */
  hiddenTypes: ReadonlySet<string>
  /** Drop nodes that were never created (linked-to but missing). */
  hideGhosts: boolean
}

/** Distinct node types present, sorted. Ghosts are excluded — they have no
 *  real type, and grouping them under `''` would conflate "untyped note"
 *  with "note that doesn't exist yet". */
export function nodeTypesIn(data: WikiGraphData): string[] {
  const types = new Set<string>()
  for (const node of data.nodes) {
    if (!node.ghost) types.add(node.isA ?? '')
  }
  return [...types].sort((a, b) => a.localeCompare(b))
}

/**
 * Narrow a graph by title query, hidden types, and ghost visibility.
 *
 * Edges are kept only when *both* endpoints survive: a link to a filtered-out
 * node would otherwise render as an edge into empty space, which reads as a
 * bug rather than a filter.
 */
export function filterGraph(data: WikiGraphData, filter: GraphFilter): WikiGraphData {
  const query = filter.query.trim().toLowerCase()
  const noFilters = !query && filter.hiddenTypes.size === 0 && !filter.hideGhosts
  if (noFilters) return data

  const nodes = data.nodes.filter((node) => {
    if (filter.hideGhosts && node.ghost) return false
    // Ghosts have no type, so type filters must not silently remove them —
    // that's what hideGhosts is for.
    if (!node.ghost && filter.hiddenTypes.has(node.isA ?? '')) return false
    if (query && !node.title.toLowerCase().includes(query)) return false
    return true
  })

  const kept = new Set(nodes.map((node) => node.id))
  const edges = data.edges.filter((edge) => kept.has(edge.source) && kept.has(edge.target))
  return { nodes, edges }
}

/** Undirected adjacency: node id → connected node ids (both directions). */
export function buildAdjacency(data: WikiGraphData): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>()
  for (const node of data.nodes) {
    adjacency.set(node.id, new Set())
  }
  for (const edge of data.edges) {
    adjacency.get(edge.source)?.add(edge.target)
    adjacency.get(edge.target)?.add(edge.source)
  }
  return adjacency
}

/** The selected node plus its direct neighbors, with induced edges only. */
export function egoSubgraph(data: WikiGraphData, nodeId: string): WikiGraphData {
  const adjacency = buildAdjacency(data)
  const neighbors = adjacency.get(nodeId)
  if (!neighbors) {
    return { nodes: [], edges: [] }
  }
  const kept = new Set([nodeId, ...neighbors])
  return {
    nodes: data.nodes.filter((n) => kept.has(n.id)),
    edges: data.edges.filter((e) => kept.has(e.source) && kept.has(e.target)),
  }
}

const DIRECTION_VECTORS: Record<GraphDirection, NodeScreenPosition> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

/**
 * Pick the neighbor of `currentId` that best matches an arrow-key
 * direction, using screen-projected positions when available. Neighbors
 * behind the direction's half-plane are excluded; the best candidate
 * maximizes alignment (dot product) relative to distance. Without
 * usable positions, falls back to sorted-neighbor cycling so keyboard
 * nav still works before the first render settles.
 */
export function nextNodeInDirection(
  adjacency: Map<string, Set<string>>,
  positions: Map<string, NodeScreenPosition>,
  currentId: string,
  direction: GraphDirection,
): string | null {
  const neighbors = adjacency.get(currentId)
  if (!neighbors || neighbors.size === 0) {
    return null
  }
  const sorted = [...neighbors].sort()
  const origin = positions.get(currentId)
  if (!origin) {
    return fallbackNeighbor(sorted, direction)
  }

  const vector = DIRECTION_VECTORS[direction]
  let best: { id: string; score: number } | null = null
  for (const id of sorted) {
    const pos = positions.get(id)
    if (!pos) continue
    const dx = pos.x - origin.x
    const dy = pos.y - origin.y
    const along = dx * vector.x + dy * vector.y
    if (along <= 0) continue
    const across = Math.abs(dx * vector.y) + Math.abs(dy * vector.x)
    const score = along - across
    if (!best || score > best.score) {
      best = { id, score }
    }
  }
  return best ? best.id : fallbackNeighbor(sorted, direction)
}

function fallbackNeighbor(sorted: string[], direction: GraphDirection): string {
  return direction === 'up' || direction === 'left'
    ? sorted[sorted.length - 1]
    : sorted[0]
}

/** Ghost count for telemetry (never includes titles or content). */
export function countGhosts(data: WikiGraphData): number {
  return data.nodes.filter((n) => n.ghost).length
}

export function findNode(data: WikiGraphData, id: string | null): WikiGraphNode | null {
  if (!id) return null
  return data.nodes.find((n) => n.id === id) ?? null
}

/**
 * Shape 3d-force-graph's `graphData()` input. Copies nodes/edges —
 * 3d-force-graph mutates node objects (x/y/z) and rewrites link
 * source/target to node references in place, so the source WikiGraphData
 * must never be handed over directly. Preserves `kind`/`field` on each
 * link so link styling (color/width) can key off connection type.
 */
export function toGraphData(data: WikiGraphData) {
  return {
    nodes: data.nodes.map((n) => ({ ...n })),
    links: data.edges.map((e) => ({ ...e })),
  }
}
