import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { NodePreviewPanel } from './NodePreviewPanel'
import type { WikiGraphNode } from './graphTypes'

function makeNode(overrides: Partial<WikiGraphNode> = {}): WikiGraphNode {
  return {
    id: 'notes/alpha.md',
    path: 'notes/alpha.md',
    title: 'Alpha',
    isA: 'Project',
    ghost: false,
    snippet: 'The first note about alpha things.',
    modifiedAt: Math.floor(Date.now() / 1000) - 3 * 86400,
    icon: null,
    linkCount: 4,
    backlinkCount: 2,
    ...overrides,
  }
}

function renderPanel(props: Partial<Parameters<typeof NodePreviewPanel>[0]> = {}) {
  const callbacks = {
    onOpenNote: vi.fn(),
    onToggleEgo: vi.fn(),
    onCreateNote: vi.fn(),
  }
  render(
    <NodePreviewPanel
      node={makeNode()}
      projects={[]}
      egoActive={false}
      nodeColor="#e05252"
      {...callbacks}
      {...props}
    />,
  )
  return callbacks
}

describe('NodePreviewPanel', () => {
  it('renders title, snippet, type chip, and relative timestamp', () => {
    renderPanel({ projects: ['Laputa'] })
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('The first note about alpha things.')).toBeInTheDocument()
    expect(screen.getByText('Project')).toBeInTheDocument()
    expect(screen.getByText('Laputa')).toBeInTheDocument()
    expect(screen.getByText('3d ago')).toBeInTheDocument()
  })

  it('colors the type dot with the resolved node color', () => {
    renderPanel()
    expect(screen.getByTestId('graph-node-type-dot')).toHaveStyle({
      backgroundColor: '#e05252',
    })
  })

  it('shows link/backlink counts as the ego-view control', () => {
    const { onToggleEgo } = renderPanel()
    const toggle = screen.getByTestId('graph-ego-toggle')
    expect(toggle).toHaveTextContent('4 links · 2 backlinks')
    fireEvent.click(toggle)
    expect(onToggleEgo).toHaveBeenCalledOnce()
  })

  it('labels the toggle as exit when ego view is active', () => {
    renderPanel({ egoActive: true })
    expect(screen.getByTestId('graph-ego-toggle')).toHaveTextContent('Full graph')
  })

  it('fires onOpenNote with the note path', () => {
    const { onOpenNote } = renderPanel()
    fireEvent.click(screen.getByTestId('graph-open-note'))
    expect(onOpenNote).toHaveBeenCalledWith('notes/alpha.md')
  })

  it('ghost variant shows the hint and a create action instead of open', () => {
    const { onCreateNote, onOpenNote } = renderPanel({
      node: makeNode({
        id: 'ghost:unwritten idea',
        path: null,
        title: 'Unwritten Idea',
        isA: null,
        ghost: true,
        snippet: '',
        modifiedAt: null,
        linkCount: 0,
        backlinkCount: 3,
      }),
    })
    expect(screen.getByText('Not created yet — linked from other notes.')).toBeInTheDocument()
    expect(screen.queryByTestId('graph-open-note')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('graph-create-note'))
    expect(onCreateNote).toHaveBeenCalledWith('Unwritten Idea')
    expect(onOpenNote).not.toHaveBeenCalled()
  })

  it('disables the create action while a job is running', () => {
    renderPanel({
      node: makeNode({ ghost: true, path: null }),
      creating: true,
    })
    const button = screen.getByTestId('graph-create-note')
    expect(button).toBeDisabled()
    expect(button).toHaveTextContent('Creating…')
  })
})
