import { describe, expect, it } from 'vitest'
import {
  buildAdjacency,
  countGhosts,
  egoSubgraph,
  filterGraph,
  findNode,
  nextNodeInDirection,
  nodeTypesIn,
  parseGraphResponse,
  toGraphData,
} from './graphData'
import type { WikiGraphData, WikiGraphNode } from './graphTypes'

function node(id: string, overrides: Partial<WikiGraphNode> = {}): WikiGraphNode {
  return {
    id,
    path: id.startsWith('ghost:') ? null : id,
    title: id,
    isA: null,
    ghost: id.startsWith('ghost:'),
    snippet: '',
    modifiedAt: null,
    linkCount: 0,
    backlinkCount: 0,
    ...overrides,
  }
}

function graph(): WikiGraphData {
  return {
    nodes: [node('a.md'), node('b.md'), node('c.md'), node('ghost:missing')],
    edges: [
      { source: 'a.md', target: 'b.md', kind: 'wikilink', field: null },
      { source: 'b.md', target: 'c.md', kind: 'belongs_to', field: null },
      { source: 'a.md', target: 'ghost:missing', kind: 'wikilink', field: null },
    ],
  }
}

describe('parseGraphResponse', () => {
  it('parses a valid payload', () => {
    const data = parseGraphResponse(JSON.stringify(graph()))
    expect(data.nodes).toHaveLength(4)
    expect(data.edges).toHaveLength(3)
  })

  it('rejects non-JSON', () => {
    expect(() => parseGraphResponse('not json')).toThrow('not JSON')
  })

  it('rejects payloads without nodes/edges arrays', () => {
    expect(() => parseGraphResponse('{"nodes": 5}')).toThrow('missing nodes/edges')
  })
})

describe('buildAdjacency', () => {
  it('is undirected and covers isolated nodes', () => {
    const adjacency = buildAdjacency(graph())
    expect(adjacency.get('a.md')).toEqual(new Set(['b.md', 'ghost:missing']))
    expect(adjacency.get('b.md')).toEqual(new Set(['a.md', 'c.md']))
    expect(adjacency.get('ghost:missing')).toEqual(new Set(['a.md']))
  })

  it('gives an empty set to nodes with no edges', () => {
    const data: WikiGraphData = { nodes: [node('lonely.md')], edges: [] }
    expect(buildAdjacency(data).get('lonely.md')).toEqual(new Set())
  })
})

describe('egoSubgraph', () => {
  it('keeps the root, direct neighbors, and induced edges only', () => {
    const ego = egoSubgraph(graph(), 'a.md')
    const ids = ego.nodes.map((n) => n.id)
    expect(ids).toEqual(['a.md', 'b.md', 'ghost:missing'])
    // b→c edge leaves the ego set: c is 2 hops from a.
    expect(ego.edges).toHaveLength(2)
    expect(ego.edges.every((e) => e.target !== 'c.md' && e.source !== 'c.md')).toBe(true)
  })

  it('returns empty subgraph for unknown root', () => {
    expect(egoSubgraph(graph(), 'nope.md')).toEqual({ nodes: [], edges: [] })
  })
})

describe('nextNodeInDirection', () => {
  const adjacency = buildAdjacency(graph())

  it('picks the neighbor along the arrow direction using positions', () => {
    const positions = new Map([
      ['a.md', { x: 100, y: 100 }],
      ['b.md', { x: 200, y: 100 }], // right of a
      ['ghost:missing', { x: 100, y: 20 }], // above a
    ])
    expect(nextNodeInDirection(adjacency, positions, 'a.md', 'right')).toBe('b.md')
    expect(nextNodeInDirection(adjacency, positions, 'a.md', 'up')).toBe('ghost:missing')
  })

  it('excludes neighbors behind the direction half-plane', () => {
    const positions = new Map([
      ['a.md', { x: 100, y: 100 }],
      ['b.md', { x: 40, y: 100 }], // left of a
      ['ghost:missing', { x: 30, y: 100 }], // also left
    ])
    // Nothing to the right: falls back to deterministic cycling.
    expect(nextNodeInDirection(adjacency, positions, 'a.md', 'right')).toBe('b.md')
  })

  it('falls back to sorted cycling when positions are unavailable', () => {
    const empty = new Map()
    expect(nextNodeInDirection(adjacency, empty, 'a.md', 'right')).toBe('b.md')
    expect(nextNodeInDirection(adjacency, empty, 'a.md', 'left')).toBe('ghost:missing')
  })

  it('returns null when the node has no neighbors', () => {
    const data: WikiGraphData = { nodes: [node('lonely.md')], edges: [] }
    expect(
      nextNodeInDirection(buildAdjacency(data), new Map(), 'lonely.md', 'down'),
    ).toBeNull()
  })
})

describe('toGraphData', () => {
  it('preserves edge kind and field so link styling can key off them', () => {
    const { links } = toGraphData(graph())
    expect(links).toEqual([
      { source: 'a.md', target: 'b.md', kind: 'wikilink', field: null },
      { source: 'b.md', target: 'c.md', kind: 'belongs_to', field: null },
      { source: 'a.md', target: 'ghost:missing', kind: 'wikilink', field: null },
    ])
  })

  it('copies nodes so 3d-force-graph mutations do not leak into source data', () => {
    const data = graph()
    const { nodes } = toGraphData(data)
    expect(nodes).not.toBe(data.nodes)
    expect(nodes[0]).not.toBe(data.nodes[0])
    expect(nodes[0]).toEqual(data.nodes[0])
  })
})

describe('countGhosts / findNode', () => {
  it('counts ghost nodes', () => {
    expect(countGhosts(graph())).toBe(1)
  })

  it('finds nodes by id and tolerates null', () => {
    expect(findNode(graph(), 'b.md')?.title).toBe('b.md')
    expect(findNode(graph(), null)).toBeNull()
    expect(findNode(graph(), 'nope')).toBeNull()
  })
})

describe('nodeTypesIn', () => {
  it('lists distinct real types, sorted, excluding ghosts', () => {
    const data = {
      nodes: [
        { id: 'a', title: 'A', isA: 'Project', ghost: false },
        { id: 'b', title: 'B', isA: 'Person', ghost: false },
        { id: 'c', title: 'C', isA: 'Project', ghost: false },
        { id: 'g', title: 'G', isA: null, ghost: true },
      ],
      edges: [],
    } as unknown as WikiGraphData
    expect(nodeTypesIn(data)).toEqual(['Person', 'Project'])
  })

  it('represents untyped real notes as the empty string', () => {
    const data = {
      nodes: [{ id: 'a', title: 'A', isA: null, ghost: false }],
      edges: [],
    } as unknown as WikiGraphData
    expect(nodeTypesIn(data)).toEqual([''])
  })
})

describe('filterGraph', () => {
  const data = {
    nodes: [
      { id: 'a', title: 'Alpha', isA: 'Project', ghost: false },
      { id: 'b', title: 'Beta', isA: 'Person', ghost: false },
      { id: 'g', title: 'Gamma', isA: null, ghost: true },
    ],
    edges: [
      { source: 'a', target: 'b', kind: 'wikilink', field: null },
      { source: 'b', target: 'g', kind: 'wikilink', field: null },
    ],
  } as unknown as WikiGraphData
  const none = { query: '', hiddenTypes: new Set<string>(), hideGhosts: false }

  it('returns the same object when nothing is filtered', () => {
    // Identity matters: the canvas re-seeds and re-frames on every data
    // change, so a new object each render would thrash the simulation.
    expect(filterGraph(data, none)).toBe(data)
  })

  it('matches titles case-insensitively on substrings', () => {
    expect(filterGraph(data, { ...none, query: 'alp' }).nodes.map((n) => n.id)).toEqual(['a'])
    expect(filterGraph(data, { ...none, query: 'ALPHA' }).nodes.map((n) => n.id)).toEqual(['a'])
  })

  it('drops edges whose endpoints were filtered out', () => {
    // An edge into a removed node would draw a line into empty space,
    // which reads as a rendering bug rather than a filter.
    const result = filterGraph(data, { ...none, query: 'alpha' })
    expect(result.edges).toEqual([])
  })

  it('keeps an edge only when both endpoints survive', () => {
    const result = filterGraph(data, { ...none, hideGhosts: true })
    expect(result.nodes.map((n) => n.id)).toEqual(['a', 'b'])
    expect(result.edges).toHaveLength(1)
    expect(result.edges[0]).toMatchObject({ source: 'a', target: 'b' })
  })

  it('hides selected types', () => {
    const result = filterGraph(data, { ...none, hiddenTypes: new Set(['Project']) })
    expect(result.nodes.map((n) => n.id)).toEqual(['b', 'g'])
  })

  it('does not let a type filter remove ghosts implicitly', () => {
    // Ghosts have isA === null, which would collide with the '' bucket
    // used for untyped notes. Only hideGhosts should remove them.
    const result = filterGraph(data, { ...none, hiddenTypes: new Set(['']) })
    expect(result.nodes.map((n) => n.id)).toContain('g')
  })

  it('combines query and type filters', () => {
    const result = filterGraph(data, {
      query: 'a',
      hiddenTypes: new Set(['Project']),
      hideGhosts: false,
    })
    // 'Alpha', 'Beta' and 'Gamma' all contain 'a'; hiding Project removes
    // only 'a', leaving the Person and the ghost.
    expect(result.nodes.map((n) => n.id)).toEqual(['b', 'g'])
  })
})
