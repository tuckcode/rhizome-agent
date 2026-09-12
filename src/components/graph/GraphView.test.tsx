import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ForceGraph3DCanvasProps } from './ForceGraph3DCanvas'

const trackEvent = vi.fn()
vi.mock('../../lib/telemetry', () => ({
  trackEvent: (...args: unknown[]) => trackEvent(...args),
}))

const startJob = vi.fn(() => Promise.resolve({ status: 'complete', output: '' }))
vi.mock('../../hooks/useRhizomeJobs', () => ({
  useRhizomeJobs: () => ({ startJob }),
}))

// WebGL is unavailable in jsdom — replace the canvas with a plain div
// that exposes the container's callbacks and received data.
let lastCanvasProps: ForceGraph3DCanvasProps | null = null
vi.mock('./ForceGraph3DCanvas', () => ({
  ForceGraph3DCanvas: (props: ForceGraph3DCanvasProps) => {
    lastCanvasProps = props
    return <div data-testid="mock-canvas" data-node-count={props.data.nodes.length} />
  },
}))

import { GraphView } from './GraphView'

async function renderGraph(onOpenNote = vi.fn()) {
  render(<GraphView vaultPath="/Users/mock/demo-vault-v2" onOpenNote={onOpenNote} />)
  await waitFor(() => expect(screen.getByTestId('graph-view')).toBeInTheDocument())
  return onOpenNote
}

beforeEach(() => {
  trackEvent.mockClear()
  startJob.mockClear()
  lastCanvasProps = null
  localStorage.clear()
})

describe('GraphView', () => {
  it('fetches the graph through the mock-tauri handler and renders the canvas', async () => {
    await renderGraph()
    expect(screen.getByTestId('mock-canvas')).toHaveAttribute('data-node-count', '4')
  })

  it('paints the graph host with the theme background so light themes are not black', async () => {
    // The WebGL canvas is transparent (backgroundColor rgba(0,0,0,0)); without
    // a themed host background the area showed solid black in light themes.
    await renderGraph()
    expect(screen.getByTestId('graph-view')).toHaveClass('bg-background')
  })

  it('clips the canvas so a compact sidebar graph cannot paint over Notes', async () => {
    render(<GraphView compact vaultPath="/Users/mock/demo-vault-v2" />)
    await waitFor(() => expect(screen.getByTestId('graph-view')).toBeInTheDocument())
    const host = screen.getByTestId('graph-canvas-host')
    expect(host).toHaveClass('overflow-hidden')
    expect(host).toHaveStyle({ clipPath: 'inset(0)' })
  })

  it('fires the view-opened telemetry with counts only (no content)', async () => {
    await renderGraph()
    expect(trackEvent).toHaveBeenCalledWith('graph_view_opened', {
      nodeCount: 4,
      edgeCount: 3,
      ghostCount: 1,
    })
  })

  it('shows the preview panel when a node is clicked', async () => {
    await renderGraph()
    act(() => lastCanvasProps?.onNodeClick('note/daily-log.md'))
    await waitFor(() =>
      expect(screen.getByTestId('graph-node-preview')).toBeInTheDocument(),
    )
    expect(screen.getByText('Daily Log')).toBeInTheDocument()
  })

  it('reports graph selection as lightweight retained state for an owning panel', async () => {
    const onRetainedStateChange = vi.fn()
    render(<GraphView vaultPath="/Users/mock/demo-vault-v2" onRetainedStateChange={onRetainedStateChange} />)
    await waitFor(() => expect(screen.getByTestId('graph-view')).toBeInTheDocument())
    act(() => lastCanvasProps?.onNodeClick('note/daily-log.md'))
    await waitFor(() => expect(onRetainedStateChange).toHaveBeenLastCalledWith(expect.objectContaining({
      selectedId: 'note/daily-log.md',
    })))
  })

  it('derives project chips from belongs_to edges', async () => {
    await renderGraph()
    act(() => lastCanvasProps?.onNodeClick('project/second-project.md'))
    await waitFor(() =>
      expect(screen.getByTestId('graph-node-preview')).toBeInTheDocument(),
    )
    expect(screen.getByText('Test Project')).toBeInTheDocument()
  })

  it('ego toggle filters the data passed to the canvas', async () => {
    await renderGraph()
    act(() => lastCanvasProps?.onNodeClick('note/daily-log.md'))
    await waitFor(() =>
      expect(screen.getByTestId('graph-node-preview')).toBeInTheDocument(),
    )
    fireEvent.click(screen.getByTestId('graph-ego-toggle'))
    await waitFor(() =>
      // daily-log + test-project + ghost; second-project is 2 hops away.
      expect(screen.getByTestId('mock-canvas')).toHaveAttribute('data-node-count', '3'),
    )
  })

  it('Escape exits ego view first, then closes the preview', async () => {
    await renderGraph()
    act(() => lastCanvasProps?.onNodeClick('note/daily-log.md'))
    await waitFor(() =>
      expect(screen.getByTestId('graph-node-preview')).toBeInTheDocument(),
    )
    fireEvent.click(screen.getByTestId('graph-ego-toggle'))
    await waitFor(() =>
      expect(screen.getByTestId('mock-canvas')).toHaveAttribute('data-node-count', '3'),
    )

    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() =>
      expect(screen.getByTestId('mock-canvas')).toHaveAttribute('data-node-count', '4'),
    )
    expect(screen.getByTestId('graph-node-preview')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() =>
      expect(screen.queryByTestId('graph-node-preview')).not.toBeInTheDocument(),
    )
  })

  it('opens a note via the panel and fires node-opened telemetry', async () => {
    const onOpenNote = await renderGraph()
    act(() => lastCanvasProps?.onNodeClick('note/daily-log.md'))
    await waitFor(() =>
      expect(screen.getByTestId('graph-node-preview')).toBeInTheDocument(),
    )
    fireEvent.click(screen.getByTestId('graph-open-note'))
    expect(onOpenNote).toHaveBeenCalledWith('note/daily-log.md')
    expect(trackEvent).toHaveBeenCalledWith('graph_node_opened', {})
  })

  it('ghost create fires the distill job with the ghost title', async () => {
    await renderGraph()
    act(() => lastCanvasProps?.onNodeClick('ghost:unwritten idea'))
    await waitFor(() =>
      expect(screen.getByTestId('graph-create-note')).toBeInTheDocument(),
    )
    fireEvent.click(screen.getByTestId('graph-create-note'))

    expect(trackEvent).toHaveBeenCalledWith('graph_ghost_create_fired', {})
    expect(startJob).toHaveBeenCalledWith(
      'rhizome_distill',
      { vaultPath: '/Users/mock/demo-vault-v2', text: 'Unwritten Idea' },
      expect.stringContaining('Unwritten Idea'),
    )
    // Let the resolved job settle its creating-state update inside act.
    await waitFor(() => expect(screen.getByTestId('graph-create-note')).not.toBeDisabled())
  })

  it('surfaces a canvas init failure as a visible error instead of staying blank', async () => {
    await renderGraph()
    expect(screen.getByTestId('mock-canvas')).toBeInTheDocument()
    act(() => lastCanvasProps?.onError?.(new Error('WebGL context creation failed')))
    await waitFor(() =>
      expect(screen.getByTestId('graph-error')).toBeInTheDocument(),
    )
    expect(screen.getByTestId('graph-error')).toHaveTextContent('WebGL context creation failed')
    expect(screen.queryByTestId('mock-canvas')).not.toBeInTheDocument()
  })

  it('docks the preview in a resizable side panel, not a floating overlay', async () => {
    await renderGraph()
    expect(screen.queryByTestId('graph-preview-dock')).not.toBeInTheDocument()
    act(() => lastCanvasProps?.onNodeClick('note/daily-log.md'))
    await waitFor(() =>
      expect(screen.getByTestId('graph-preview-dock')).toBeInTheDocument(),
    )
    const dock = screen.getByTestId('graph-preview-dock')
    // Docked, not floating: the panel lives in a fixed-width flex column, not
    // an `absolute` overlay pinned to the canvas corner.
    expect(dock).not.toHaveClass('absolute')
    expect(dock).toHaveStyle({ width: '340px' })
    expect(dock).toContainElement(screen.getByTestId('graph-node-preview'))
    // A drag handle sits alongside the dock (same recipe as the Inspector).
    expect(document.querySelector('.cursor-col-resize')).toBeInTheDocument()
  })

  it('applies the persisted graphPreview width to the docked panel', async () => {
    localStorage.setItem('tolaria:layout-panels', JSON.stringify({ graphPreview: 420 }))
    await renderGraph()
    act(() => lastCanvasProps?.onNodeClick('note/daily-log.md'))
    await waitFor(() =>
      expect(screen.getByTestId('graph-preview-dock')).toBeInTheDocument(),
    )
    expect(screen.getByTestId('graph-preview-dock')).toHaveStyle({ width: '420px' })
  })

  it('removes the dock and resize handle when the selection clears', async () => {
    await renderGraph()
    act(() => lastCanvasProps?.onNodeClick('note/daily-log.md'))
    await waitFor(() =>
      expect(screen.getByTestId('graph-preview-dock')).toBeInTheDocument(),
    )
    act(() => lastCanvasProps?.onBackgroundClick())
    await waitFor(() =>
      expect(screen.queryByTestId('graph-preview-dock')).not.toBeInTheDocument(),
    )
    expect(document.querySelector('.cursor-col-resize')).not.toBeInTheDocument()
  })

  it('arrow keys step selection to a connected node', async () => {
    await renderGraph()
    act(() => lastCanvasProps?.onNodeClick('note/daily-log.md'))
    await waitFor(() =>
      expect(screen.getByTestId('graph-node-preview')).toBeInTheDocument(),
    )
    // No positions from the mocked canvas → deterministic sorted fallback.
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    await waitFor(() => expect(screen.getByText('Unwritten Idea')).toBeInTheDocument())
  })
})

describe('GraphView exit affordance', () => {
  async function renderWithExit() {
    const onExit = vi.fn()
    render(<GraphView vaultPath="/Users/mock/demo-vault-v2" onOpenNote={vi.fn()} onExit={onExit} />)
    await waitFor(() => expect(screen.getByTestId('graph-view')).toBeInTheDocument())
    return onExit
  }

  it('renders a visible close control so the graph is not a one-way trap', async () => {
    const onExit = await renderWithExit()

    fireEvent.click(screen.getByTestId('graph-exit'))

    expect(onExit).toHaveBeenCalledOnce()
  })

  it('exits the graph on Escape when nothing is selected', async () => {
    const onExit = await renderWithExit()

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(onExit).toHaveBeenCalledOnce()
  })
})
