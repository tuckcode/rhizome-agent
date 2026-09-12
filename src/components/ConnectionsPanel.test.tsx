import { createRef } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { ConnectionsPanel, type ConnectionsPanelHandle } from './ConnectionsPanel'
import type { SessionActivityRetainedState } from './SessionActivityHistory'
vi.mock('./graph/GraphView', () => ({ default: ({ onOpenNote }: { onOpenNote?: (path: string) => void }) => <button type="button" onClick={() => onOpenNote?.('/vault/graph.md')}>Graph canvas</button> }))
vi.mock('./SessionActivityHistory', () => ({ SessionActivityHistory: ({ onOpenNote, retainedState }: { onOpenNote?: (path: string) => void, retainedState?: SessionActivityRetainedState }) => <button type="button" data-testid="mock-session-activity" data-focused-path={retainedState?.path || ''} onClick={() => onOpenNote?.('/vault/activity.md')}>Recorded actions</button> }))
beforeEach(() => localStorage.clear())
it('shows Graph immediately, with no closed-edge strip', async () => {
  render(<ConnectionsPanel vaultPath="/vault" />)
  expect(screen.queryByTestId('connections-edge')).not.toBeInTheDocument()
  expect(await screen.findByText('Graph canvas')).toBeVisible()
})
it('clips Graph to its own pane so it cannot paint over the Changes list', async () => {
  render(<ConnectionsPanel vaultPath="/vault" />)
  const pane = await screen.findByTestId('connections-panel')
  expect(pane).toHaveClass('overflow-hidden')
  expect(screen.getByRole('region', { name: 'Connections' })).toHaveStyle({ maxHeight: '50%' })
})
it('shows one view at a time and can expand and collapse it', async () => {
  render(<ConnectionsPanel vaultPath="/vault" />)
  expect(await screen.findByText('Graph canvas')).toBeVisible()
  fireEvent.click(screen.getByRole('tab', { name: 'Mycelium' }))
  expect(await screen.findByText('Recorded actions')).toBeVisible()
  expect(screen.queryByText('Graph canvas')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Expand connections' }))
  expect(screen.getByTestId('connections-panel')).toHaveAttribute('data-expanded', 'true')
  fireEvent.click(screen.getByRole('button', { name: 'Return to side panel' }))
  expect(screen.getByTestId('connections-panel')).toHaveAttribute('data-expanded', 'false')
})
it('tears down the inactive renderer when switching views', async () => {
  render(<ConnectionsPanel vaultPath="/vault" />)
  expect(await screen.findByText('Graph canvas')).toBeVisible()
  fireEvent.click(screen.getByRole('tab', { name: 'Mycelium' }))
  expect(await screen.findByText('Recorded actions')).toBeVisible()
  expect(screen.queryByText('Graph canvas')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('tab', { name: 'Graph' }))
  expect(await screen.findByText('Graph canvas')).toBeVisible()
  expect(screen.queryByText('Recorded actions')).not.toBeInTheDocument()
})
it('collapses the expanded overlay when either view opens a note, and keeps the sub-panel', async () => {
  const open = vi.fn()
  render(<ConnectionsPanel vaultPath="/vault" onOpenNote={open} />)
  fireEvent.click(screen.getByRole('tab', { name: 'Mycelium' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Expand connections' }))
  fireEvent.click(await screen.findByText('Recorded actions'))
  expect(open).toHaveBeenCalledWith('/vault/activity.md')
  expect(screen.getByTestId('connections-panel')).toHaveAttribute('data-expanded', 'false')
})
it('opens a requested view through the imperative handle', async () => {
  const ref = createRef<ConnectionsPanelHandle>()
  render(<ConnectionsPanel ref={ref} vaultPath="/vault" />)
  expect(await screen.findByText('Graph canvas')).toBeVisible()
  act(() => { ref.current?.openView('mycelium') })
  expect(await screen.findByText('Recorded actions')).toBeVisible()
})
it('focuses a specific Mycelium session when a caller requests it', async () => {
  const ref = createRef<ConnectionsPanelHandle>()
  render(<ConnectionsPanel ref={ref} vaultPath="/vault" />)
  act(() => { ref.current?.openView('mycelium', { focusPath: '/prime/sessions/abc.jsonl' }) })
  expect(await screen.findByTestId('mock-session-activity')).toHaveAttribute('data-focused-path', '/prime/sessions/abc.jsonl')
})
it('re-focuses Mycelium to a new session on a second request', async () => {
  const ref = createRef<ConnectionsPanelHandle>()
  render(<ConnectionsPanel ref={ref} vaultPath="/vault" />)
  act(() => { ref.current?.openView('mycelium', { focusPath: '/prime/sessions/first.jsonl' }) })
  expect(await screen.findByTestId('mock-session-activity')).toHaveAttribute('data-focused-path', '/prime/sessions/first.jsonl')
  act(() => { ref.current?.openView('mycelium', { focusPath: '/prime/sessions/second.jsonl' }) })
  await waitFor(() => expect(screen.getByTestId('mock-session-activity')).toHaveAttribute('data-focused-path', '/prime/sessions/second.jsonl'))
})
it('honours a requested view passed as a prop on first mount', async () => {
  render(
    <ConnectionsPanel
      vaultPath="/vault"
      requestedView={{ view: 'mycelium', focusPath: '/prime/sessions/prop.jsonl', requestId: 1 }}
    />,
  )
  expect(await screen.findByTestId('mock-session-activity')).toHaveAttribute('data-focused-path', '/prime/sessions/prop.jsonl')
})
/**
 * Graph sits under Notes, so its handle is on its top edge. Dragging that
 * handle up must make the panel taller. `usePanelWidth.resizeBy` already
 * treats a negative delta as growth, which matches a top-edge drag.
 */
it('grows when its top edge is dragged upward', async () => {
  render(<ConnectionsPanel vaultPath="/vault" />)
  const panel = await screen.findByRole('region', { name: 'Connections' })
  const startingHeight = panel.style.height

  fireEvent.mouseDown(screen.getByRole('separator', { name: 'Resize graph' }), { clientX: 400, clientY: 500 })
  fireEvent.mouseMove(window, { clientX: 400, clientY: 400 })
  fireEvent.mouseUp(window)

  expect(parseInt(panel.style.height, 10)).toBeGreaterThan(parseInt(startingHeight, 10))
})

it('shrinks when its top edge is dragged downward', async () => {
  render(<ConnectionsPanel vaultPath="/vault" />)
  const panel = await screen.findByRole('region', { name: 'Connections' })
  const startingHeight = panel.style.height

  fireEvent.mouseDown(screen.getByRole('separator', { name: 'Resize graph' }), { clientX: 400, clientY: 400 })
  fireEvent.mouseMove(window, { clientX: 400, clientY: 500 })
  fireEvent.mouseUp(window)

  expect(parseInt(panel.style.height, 10)).toBeLessThan(parseInt(startingHeight, 10))
})

it('persists independent view preferences and retains a way to re-enable views', () => {
  const first = render(<ConnectionsPanel vaultPath="/vault" />)
  fireEvent.click(screen.getByText('Connections settings'))
  fireEvent.change(screen.getByLabelText('Graph placement'), { target: { value: 'off' } })
  fireEvent.change(screen.getByLabelText('Mycelium placement'), { target: { value: 'off' } })
  first.unmount()
  render(<ConnectionsPanel vaultPath="/vault" />)
  expect(screen.getByText('Enable a view in Connections settings.')).toBeVisible()
  expect(screen.queryByRole('tab')).not.toBeInTheDocument()
})
