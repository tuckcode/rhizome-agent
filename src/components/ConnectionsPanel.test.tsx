import { createRef } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { ConnectionsPanel, type ConnectionsPanelHandle } from './ConnectionsPanel'
import type { SessionActivityRetainedState } from './SessionActivityHistory'
vi.mock('./graph/GraphView', () => ({ default: ({ onOpenNote }: { onOpenNote?: (path: string) => void }) => <button type="button" onClick={() => onOpenNote?.('/vault/graph.md')}>Graph canvas</button> }))
vi.mock('./SessionActivityHistory', () => ({ SessionActivityHistory: ({ onOpenNote, retainedState }: { onOpenNote?: (path: string) => void, retainedState?: SessionActivityRetainedState }) => <button type="button" data-testid="mock-session-activity" data-focused-path={retainedState?.path || ''} onClick={() => onOpenNote?.('/vault/activity.md')}>Recorded actions</button> }))
beforeEach(() => localStorage.clear())
it('stays closed until a view is requested', async () => {
  render(<ConnectionsPanel vaultPath="/vault" />)
  expect(screen.queryByTestId('connections-panel')).not.toBeInTheDocument()
  expect(screen.queryByText('Graph canvas')).not.toBeInTheDocument()
})
it('opens Graph over the workspace, not as a half-height dock', async () => {
  const ref = createRef<ConnectionsPanelHandle>()
  render(<ConnectionsPanel ref={ref} vaultPath="/vault" />)
  act(() => { ref.current?.openView('graph') })
  const pane = await screen.findByTestId('connections-panel')
  expect(pane).toHaveClass('overflow-hidden')
  expect(pane).toHaveAttribute('data-expanded', 'true')
  expect(pane).not.toHaveStyle({ maxHeight: '50%' })
  expect(await screen.findByText('Graph canvas')).toBeVisible()
})
it('shows one view at a time and can close it', async () => {
  const ref = createRef<ConnectionsPanelHandle>()
  render(<ConnectionsPanel ref={ref} vaultPath="/vault" />)
  act(() => { ref.current?.openView('graph') })
  expect(await screen.findByText('Graph canvas')).toBeVisible()
  fireEvent.click(screen.getByRole('tab', { name: 'Mycelium' }))
  expect(await screen.findByText('Recorded actions')).toBeVisible()
  expect(screen.queryByText('Graph canvas')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Close connections' }))
  expect(screen.queryByTestId('connections-panel')).not.toBeInTheDocument()
})
it('tears down the inactive renderer when switching views', async () => {
  const ref = createRef<ConnectionsPanelHandle>()
  render(<ConnectionsPanel ref={ref} vaultPath="/vault" />)
  act(() => { ref.current?.openView('graph') })
  expect(await screen.findByText('Graph canvas')).toBeVisible()
  fireEvent.click(screen.getByRole('tab', { name: 'Mycelium' }))
  expect(await screen.findByText('Recorded actions')).toBeVisible()
  expect(screen.queryByText('Graph canvas')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('tab', { name: 'Graph' }))
  expect(await screen.findByText('Graph canvas')).toBeVisible()
  expect(screen.queryByText('Recorded actions')).not.toBeInTheDocument()
})
it('closes when either view opens a note', async () => {
  const open = vi.fn()
  const ref = createRef<ConnectionsPanelHandle>()
  render(<ConnectionsPanel ref={ref} vaultPath="/vault" onOpenNote={open} />)
  act(() => { ref.current?.openView('mycelium') })
  fireEvent.click(await screen.findByText('Recorded actions'))
  expect(open).toHaveBeenCalledWith('/vault/activity.md')
  expect(screen.queryByTestId('connections-panel')).not.toBeInTheDocument()
})
it('opens a requested view through the imperative handle', async () => {
  const ref = createRef<ConnectionsPanelHandle>()
  render(<ConnectionsPanel ref={ref} vaultPath="/vault" />)
  expect(screen.queryByText('Graph canvas')).not.toBeInTheDocument()
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
it('stays closed when both views were turned off, until one is opened', async () => {
  localStorage.setItem('rhizome:connections-placement:v1', JSON.stringify({ graph: 'off', mycelium: 'off' }))
  const ref = createRef<ConnectionsPanelHandle>()
  render(<ConnectionsPanel ref={ref} vaultPath="/vault" />)
  expect(screen.queryByTestId('connections-panel')).not.toBeInTheDocument()
  act(() => { ref.current?.openView('graph') })
  expect(await screen.findByRole('tab', { name: 'Graph' })).toBeInTheDocument()
})

it('opens Mycelium from the notes-chrome shortcut and turns the view back on', async () => {
  localStorage.setItem('rhizome:connections-placement:v1', JSON.stringify({ graph: 'sidebar', mycelium: 'off' }))
  render(<ConnectionsPanel vaultPath="/vault" />)
  expect(screen.queryByRole('tab', { name: 'Mycelium' })).not.toBeInTheDocument()
  act(() => {
    window.dispatchEvent(new CustomEvent('rhizome:notes-chrome', { detail: 'mycelium' }))
  })
  expect(await screen.findByRole('tab', { name: 'Mycelium' })).toBeInTheDocument()
  expect(await screen.findByText('Recorded actions')).toBeVisible()
})
