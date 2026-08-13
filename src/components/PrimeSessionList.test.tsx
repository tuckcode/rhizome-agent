import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PrimeSessionList from './PrimeSessionList'
import type { PrimeSessionSummary } from '../lib/primeSessionGroups'

const invoked = vi.hoisted(() => ({ calls: [] as string[], result: [] as unknown[], fail: '' }))

vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: (cmd: string) => {
    invoked.calls.push(cmd)
    if (invoked.fail) return Promise.reject(new Error(invoked.fail))
    return Promise.resolve(invoked.result)
  },
}))

const tracked = vi.hoisted(() => ({ opened: [] as number[], selected: [] as string[] }))
vi.mock('../lib/productAnalytics', () => ({
  trackPrimeSessionListOpened: (count: number) => tracked.opened.push(count),
  trackPrimeSessionOpened: (group: string) => tracked.selected.push(group),
}))

const NOW = new Date(2026, 7, 13, 15, 0, 0).getTime()
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

function summary(overrides: Partial<PrimeSessionSummary> = {}): PrimeSessionSummary {
  return { id: 'id-1', path: '/sessions/id-1.jsonl', mtimeMs: NOW - HOUR, ...overrides }
}

beforeEach(() => {
  invoked.calls = []
  invoked.result = []
  invoked.fail = ''
  tracked.opened = []
  tracked.selected = []
})

describe('PrimeSessionList', () => {
  it('reads summaries only — never a transcript', async () => {
    render(<PrimeSessionList now={NOW} />)

    await waitFor(() => expect(invoked.calls).toContain('list_prime_session_summaries'))
    // Opening the list must not read a 2 MB log for every row.
    expect(invoked.calls).not.toContain('read_prime_session_transcript')
  })

  it('renders sessions under their time group', async () => {
    invoked.result = [
      summary({ id: 'a', title: 'today work', mtimeMs: NOW - HOUR }),
      summary({ id: 'b', title: 'older work', mtimeMs: NOW - 4 * DAY }),
    ]

    render(<PrimeSessionList now={NOW} />)

    expect(await screen.findByText('today work')).toBeInTheDocument()
    expect(screen.getByText('older work')).toBeInTheDocument()
    expect(screen.getByText('Today')).toBeInTheDocument()
    expect(screen.getByText('Previous 7 days')).toBeInTheDocument()
  })

  it('hands the chosen session to the caller rather than loading it itself', async () => {
    invoked.result = [summary({ id: 'a', title: 'pick me' })]
    const onSelectSession = vi.fn()

    render(<PrimeSessionList now={NOW} onSelectSession={onSelectSession} />)
    fireEvent.click(await screen.findByRole('button', { name: /pick me/ }))

    expect(onSelectSession).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }))
    expect(invoked.calls).not.toContain('read_prime_session_transcript')
  })

  /** A uuid filename names nothing to a human — never show it as the label. */
  it('labels a session with no title as untitled, not as its id or path', async () => {
    invoked.result = [summary({ id: '019fe641-61fa-73e9', title: null })]

    render(<PrimeSessionList now={NOW} />)

    expect(await screen.findByText('Untitled session')).toBeInTheDocument()
    expect(screen.queryByText(/019fe641/)).not.toBeInTheDocument()
    expect(screen.queryByText(/\.jsonl/)).not.toBeInTheDocument()
  })

  // The design system's session item is title over a meta line; meta answers
  // "which project, how stale" — never the full path.
  it('shows the project and how stale a session is, not its whole path', async () => {
    invoked.result = [
      summary({ title: 'work', cwd: '/Users/dtc/code/projects/rhizome-agent', mtimeMs: NOW - 2 * HOUR }),
    ]

    render(<PrimeSessionList now={NOW} />)

    expect(await screen.findByText('rhizome-agent · 2h ago')).toBeInTheDocument()
    expect(screen.queryByText(/\/Users\/dtc/)).not.toBeInTheDocument()
  })

  it('still renders a row for a session with no cwd and no timestamp', async () => {
    invoked.result = [summary({ title: 'bare', cwd: null, mtimeMs: null })]

    render(<PrimeSessionList now={NOW} />)

    expect(await screen.findByText('bare')).toBeInTheDocument()
  })

  it('explains an empty list instead of rendering nothing', async () => {
    render(<PrimeSessionList now={NOW} />)

    expect(await screen.findByText(/No Prime sessions yet/)).toBeInTheDocument()
  })

  it('surfaces a read failure instead of looking empty', async () => {
    invoked.fail = 'permission denied'

    render(<PrimeSessionList now={NOW} />)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/permission denied/)
  })

  it('reports the list size in buckets and the age of what was opened', async () => {
    invoked.result = [summary({ id: 'a', title: 'pick me', mtimeMs: NOW - 4 * DAY })]

    render(<PrimeSessionList now={NOW} />)
    fireEvent.click(await screen.findByRole('button', { name: /pick me/ }))

    await waitFor(() => expect(tracked.opened).toEqual([1]))
    expect(tracked.selected).toEqual(['week'])
  })
})
