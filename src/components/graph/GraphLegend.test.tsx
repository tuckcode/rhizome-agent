import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GraphLegend } from './GraphLegend'
import type { WikiGraphData, WikiGraphNode } from './graphTypes'

const mockTrack = vi.fn()
vi.mock('../../lib/productAnalytics', () => ({
  trackGraphLegendToggled: (state: string) => mockTrack(state),
}))

function node(id: string, isA: string | null, ghost = false): WikiGraphNode {
  return { id, title: id, path: `${id}.md`, isA, ghost } as WikiGraphNode
}

function data(overrides: Partial<WikiGraphData> = {}): WikiGraphData {
  return {
    nodes: [node('a', 'Project'), node('b', 'Person'), node('c', 'Project')],
    edges: [{ source: 'a', target: 'b', kind: 'wikilink' }],
    ...overrides,
  } as WikiGraphData
}

const colorForNode = (n: WikiGraphNode) => (n.isA === 'Project' ? '#f00' : '#0f0')
const colorForEdge = () => '#00f'

function renderLegend(d: WikiGraphData = data(), ghostCount = 0, defaultOpen = true) {
  return render(
    <GraphLegend
      data={d}
      ghostCount={ghostCount}
      colorForNode={colorForNode}
      colorForEdge={colorForEdge}
      locale="en"
      defaultOpen={defaultOpen}
    />,
  )
}

describe('GraphLegend', () => {
  beforeEach(() => vi.clearAllMocks())

  it('starts collapsed so a large key does not cover the graph', () => {
    render(<GraphLegend data={data()} ghostCount={0} colorForNode={colorForNode} colorForEdge={colorForEdge} locale="en" />)
    expect(screen.getByTestId('graph-legend-toggle')).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByTestId('graph-legend-body')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('graph-legend-toggle'))
    expect(screen.getByTestId('graph-legend-body')).toBeInTheDocument()
  })

  it('lists each node type once, not once per node', () => {
    // Two Project nodes must produce one Project row.
    renderLegend()
    expect(screen.getAllByText('Project')).toHaveLength(1)
    expect(screen.getByText('Person')).toBeInTheDocument()
  })

  it('only explains edge kinds the graph actually contains', () => {
    // The graph builder can emit four kinds; a legend listing all four on a
    // wikilink-only vault teaches something untrue about that vault.
    renderLegend()
    expect(screen.getByText('Wikilink')).toBeInTheDocument()
    expect(screen.queryByText('Belongs to')).not.toBeInTheDocument()
    expect(screen.queryByText('Related to')).not.toBeInTheDocument()
  })

  it('shows every edge kind present when the graph is richer', () => {
    renderLegend(
      data({
        edges: [
          { source: 'a', target: 'b', kind: 'wikilink' },
          { source: 'a', target: 'c', kind: 'belongs_to' },
          { source: 'b', target: 'c', kind: 'relationship' },
        ],
      } as Partial<WikiGraphData>),
    )
    expect(screen.getByText('Wikilink')).toBeInTheDocument()
    expect(screen.getByText('Belongs to')).toBeInTheDocument()
    expect(screen.getByText('Relationship')).toBeInTheDocument()
    expect(screen.queryByText('Related to')).not.toBeInTheDocument()
  })

  it('counts notes and links', () => {
    expect(renderLegend().getByTestId('graph-legend-counts').textContent).toContain('3 notes')
    expect(screen.getByTestId('graph-legend-counts').textContent).toContain('1 links')
  })

  it('hides the ghost row entirely when nothing is uncreated', () => {
    renderLegend(data(), 0)
    expect(screen.queryByTestId('graph-legend-ghost')).not.toBeInTheDocument()
    expect(screen.queryByTestId('graph-legend-ghost-count')).not.toBeInTheDocument()
  })

  it('explains ghosts when the graph has them', () => {
    renderLegend(data(), 2)
    expect(screen.getByTestId('graph-legend-ghost-count').textContent).toContain('2')
    expect(screen.getByText('Not created yet')).toBeInTheDocument()
  })

  it('excludes ghost nodes from the type list', () => {
    // A ghost has no real type — it would otherwise show as "Untyped"
    // alongside its own dedicated legend row.
    renderLegend(
      data({ nodes: [node('a', 'Project'), node('ghost', null, true)] } as Partial<WikiGraphData>),
      1,
    )
    expect(screen.queryByText('Untyped')).not.toBeInTheDocument()
  })

  it('labels nodes with no type rather than showing a blank row', () => {
    renderLegend(data({ nodes: [node('a', null)] } as Partial<WikiGraphData>))
    expect(screen.getByText('Untyped')).toBeInTheDocument()
  })

  it('collapses and expands, and reports which way it went', () => {
    renderLegend()
    expect(screen.getByTestId('graph-legend-body')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('graph-legend-toggle'))
    expect(screen.queryByTestId('graph-legend-body')).not.toBeInTheDocument()
    expect(mockTrack).toHaveBeenCalledWith('closed')

    fireEvent.click(screen.getByTestId('graph-legend-toggle'))
    expect(screen.getByTestId('graph-legend-body')).toBeInTheDocument()
    expect(mockTrack).toHaveBeenCalledWith('opened')
  })

  it('surfaces the keyboard controls, which are otherwise undiscoverable', () => {
    renderLegend()
    expect(screen.getByTestId('graph-legend-controls').textContent).toMatch(/Arrows|Enter|Esc/)
  })
})
