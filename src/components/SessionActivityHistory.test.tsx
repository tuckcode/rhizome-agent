import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { callHost } from '../lib/callHost'
import { SessionActivityHistory } from './SessionActivityHistory'
vi.mock('../lib/callHost', () => ({ callHost: vi.fn() }))
vi.mock('./MyceliumView', () => ({ default: () => <div>Mycelium canvas</div> }))
function mockTranscript(tools: { id: string; tool: string; path?: string; detail?: string }[]) {
  vi.mocked(callHost).mockImplementation(async command => command === 'list_prime_sessions'
    ? [{ path: '/sessions/test', name: 'Audit session' }]
    : [{ kind: 'message', message: { role: 'user', text: 'Fix the editor', content: [] } },
      { kind: 'message', message: { role: 'assistant', text: '', content: [] }, tools }])
}
it('shows a readable session card in the compact pane, not the prompt dump', async () => {
  const historyOpen = ['<', 'conversation_history', '>'].join('')
  const historyClose = ['</', 'conversation_history', '>'].join('')
  vi.mocked(callHost).mockImplementation(async command => command === 'list_prime_sessions'
    ? [{ path: '/sessions/test', name: `${historyOpen} [user]: hi [assistant]: Hi, Atticus. ${historyClose}` }]
    : [{ kind: 'message', message: { role: 'user', text: `${historyOpen}\n[user]: hi\n`, content: [] } },
      { kind: 'message', message: { role: 'assistant', text: '', content: [] }, tools: [
        { id: 'one', tool: 'ipython', path: '/vault/scratch.py', detail: 'run cells' },
        { id: 'two', tool: 'read_file', path: '/vault/editor.md' },
      ] }])
  render(<SessionActivityHistory expanded={false} locale="en" vaultPath="/vault" onOpenNote={vi.fn()} />)
  expect(await screen.findByTestId('mycelium-compact-title')).toHaveTextContent('hi')
  expect(screen.getByText('2 tools · 2 files')).toBeVisible()
  expect(screen.getByText(/scratch.py, editor.md/)).toBeVisible()
  expect(screen.queryByText(historyOpen)).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /1. ipython/ })).not.toBeInTheDocument()
  expect(screen.queryByText('Mycelium canvas')).not.toBeInTheDocument()
})
it('reveals the request and command for a recorded action and opens its file', async () => {
  mockTranscript([{ id: 'one', tool: 'read_file', path: '/vault/editor.md', detail: 'Read editor source' }])
  const open = vi.fn()
  render(<SessionActivityHistory expanded locale="en" vaultPath="/vault" onOpenNote={open} />)
  fireEvent.click(await screen.findByRole('button', { name: /1. read_file/ }))
  expect(screen.getByText('Fix the editor')).toBeVisible()
  expect(screen.getByText('Read editor source')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Open file' }))
  expect(open).toHaveBeenCalledWith('/vault/editor.md')
  await waitFor(() => expect(callHost).toHaveBeenCalledWith('read_prime_session_transcript', { path: '/sessions/test' }))
})
it('does not offer to open a path the vault opener cannot resolve', async () => {
  mockTranscript([{ id: 'one', tool: 'edit_file', path: '/Users/dtc/code/app.ts', detail: 'Patch app' }])
  render(<SessionActivityHistory expanded locale="en" vaultPath="/vault" onOpenNote={vi.fn()} />)
  fireEvent.click(await screen.findByRole('button', { name: /1. edit_file/ }))
  expect(screen.queryByRole('button', { name: 'Open file' })).not.toBeInTheDocument()
  expect(screen.getByText('Outside this vault — not openable here.')).toBeVisible()
})
it('does not offer to open a note the host cannot resolve', async () => {
  mockTranscript([{ id: 'one', tool: 'get_note', path: 'other-vault/plan.md', detail: 'Read plan' }])
  render(<SessionActivityHistory expanded locale="en" vaultPath="/vault" canOpenNote={() => false} onOpenNote={vi.fn()} />)
  fireEvent.click(await screen.findByRole('button', { name: /1. get_note/ }))
  expect(screen.queryByRole('button', { name: 'Open file' })).not.toBeInTheDocument()
})
it('highlights the files an action touched beside Mycelium', async () => {
  mockTranscript([
    { id: 'one', tool: 'read_file', path: '/vault/editor.md' },
    { id: 'two', tool: 'write_file', path: '/vault/notes/plan.md' },
  ])
  render(<SessionActivityHistory expanded locale="en" vaultPath="/vault" onOpenNote={vi.fn()} />)
  expect(await screen.findByText('Files and notes this session touched')).toBeVisible()
  fireEvent.click(await screen.findByRole('button', { name: /2. write_file/ }))
  expect(screen.getByText('Touched by step 2')).toBeVisible()
  const touched = screen.getByTestId('touched-files')
  expect(within(touched).getByRole('button', { name: 'plan.md' })).toHaveAttribute('aria-current', 'true')
  expect(within(touched).getByRole('button', { name: 'editor.md' })).not.toHaveAttribute('aria-current')
})

it('reports the selected session action as lightweight retained state', async () => {
  mockTranscript([{ id: 'one', tool: 'read_file', path: '/vault/editor.md' }])
  const onRetainedStateChange = vi.fn()
  render(<SessionActivityHistory expanded locale="en" vaultPath="/vault" onOpenNote={vi.fn()} onRetainedStateChange={onRetainedStateChange} />)
  fireEvent.click(await screen.findByRole('button', { name: /1. read_file/ }))
  await waitFor(() => expect(onRetainedStateChange).toHaveBeenLastCalledWith(expect.objectContaining({
    path: '/sessions/test',
    selected: 0,
  })))
})
