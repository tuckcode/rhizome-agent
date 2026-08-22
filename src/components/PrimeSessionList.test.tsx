import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PrimeSessionList from './PrimeSessionList'
import type { PrimeSessionSummary } from '../lib/primeSessionMeta'

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
  trackPrimeSessionOpened: (age: string) => tracked.selected.push(age),
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
  /**
   * The host can answer with something that is not a list — a mock that has no
   * handler for the command, a Tauri command that returns null, a build where
   * the command is absent. `listed.length` then threw inside the effect, which
   * surfaces as an unhandled rejection rather than an error the panel can show.
   * Found when Chat home started opening this list by default: every `App`
   * test suddenly mounted it and three unhandled rejections appeared.
   */
  /**
   * #28's title, and the half #30 carried: two sessions with no title rendered
   * as two rows both reading "Untitled", stacked and impossible to tell apart.
   * A session with messages but no *user* message has no title, so this
   * survives the filter that drops empty ones.
   *
   * Asserted at the component rather than only on `primeSessionRowTitles`
   * because the defect was always about what reaches the screen — the unit
   * that computed the label was never wrong, it was simply not called.
   */
  it('never shows two rows a user cannot tell apart', async () => {
    invoked.result = [
      summary({ id: '01a0252e-b9d5-71e9-83de-2bce32f65c06', path: '/sessions/a.jsonl' }),
      summary({ id: '01a0252e-b6b9-749a-ad79-4c8c33e521f9', path: '/sessions/b.jsonl' }),
    ]

    render(<PrimeSessionList onSelect={vi.fn()} locale="en" now={NOW} />)

    await waitFor(() => expect(screen.getAllByRole('button', { name: /Open session/ })).toHaveLength(2))
    const labels = screen
      .getAllByRole('button', { name: /Open session/ })
      .map((button) => button.getAttribute('aria-label'))
    expect(new Set(labels).size).toBe(2)
    // The suffix is the end of the id, not the start: these two are uuidv7 and
    // share their first eight characters, which are a timestamp.
    expect(screen.getByText('Untitled session · f65c06')).toBeInTheDocument()
    expect(screen.getByText('Untitled session · e521f9')).toBeInTheDocument()
  })

  it('leaves a titled session alone while its untitled neighbours are suffixed', async () => {
    invoked.result = [
      summary({ id: 'aaaaaa', path: '/sessions/a.jsonl', title: 'Release notes' }),
      summary({ id: 'bbbbbb', path: '/sessions/b.jsonl' }),
      summary({ id: 'cccccc', path: '/sessions/c.jsonl' }),
    ]

    render(<PrimeSessionList onSelect={vi.fn()} locale="en" now={NOW} />)

    expect(await screen.findByText('Release notes')).toBeInTheDocument()
    expect(screen.getByText('Untitled session · bbbbbb')).toBeInTheDocument()
    expect(screen.getByText('Untitled session · cccccc')).toBeInTheDocument()
  })

  it('survives a host that answers with no list at all', async () => {
    invoked.result = null as unknown as unknown[]

    render(<PrimeSessionList onSelect={vi.fn()} locale="en" />)

    expect(await screen.findByText('No Prime sessions yet. Start a conversation and it will appear here.')).toBeInTheDocument()
  })

  it('reads summaries only — opening the list never reads a transcript', async () => {
    render(<PrimeSessionList now={NOW} />)

    await waitFor(() => expect(invoked.calls).toContain('list_prime_session_summaries'))
    expect(invoked.calls).not.toContain('read_prime_session_transcript')
  })

  /** Frame F: a flat list where each row carries its own day in the meta. */
  it('lists sessions newest first with a day-stamped meta line', async () => {
    invoked.result = [
      summary({ id: 'old', title: 'older work', mtimeMs: NOW - DAY - HOUR }),
      summary({ id: 'new', title: 'todays work', mtimeMs: new Date(2026, 7, 13, 14, 8).getTime() }),
    ]

    render(<PrimeSessionList now={NOW} />)

    expect(await screen.findByText('Today · 14:08')).toBeInTheDocument()
    expect(screen.getByText('Yesterday')).toBeInTheDocument()

    const rows = screen.getAllByRole('button').filter((b) => b.getAttribute('aria-current') !== null || /work/.test(b.textContent ?? ''))
    expect(rows[0]).toHaveTextContent('todays work')
  })

  it('hands the chosen session to the caller rather than switching itself', async () => {
    invoked.result = [summary({ id: 'a', title: 'pick me' })]
    const onSelectSession = vi.fn()

    render(<PrimeSessionList now={NOW} onSelectSession={onSelectSession} />)
    fireEvent.click(await screen.findByRole('button', { name: /pick me/ }))

    expect(onSelectSession).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }))
    expect(invoked.calls).not.toContain('switch_prime_session')
  })

  /** A uuid filename names nothing to a human — never show it as the label. */
  it('labels a session with no title as untitled, not as its id or path', async () => {
    invoked.result = [summary({ id: '019fe641-61fa-73e9', title: null })]

    render(<PrimeSessionList now={NOW} />)

    expect(await screen.findByText('Untitled session')).toBeInTheDocument()
    expect(screen.queryByText(/019fe641/)).not.toBeInTheDocument()
    expect(screen.queryByText(/\.jsonl/)).not.toBeInTheDocument()
  })

  it('marks the session the host is on as current', async () => {
    invoked.result = [
      summary({ id: 'a', title: 'active one', path: '/sessions/a.jsonl' }),
      summary({ id: 'b', title: 'other one', path: '/sessions/b.jsonl' }),
    ]

    render(<PrimeSessionList now={NOW} activeSessionPath="/sessions/a.jsonl" />)

    const active = await screen.findByRole('button', { name: /active one/ })
    expect(active).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('button', { name: /other one/ })).not.toHaveAttribute('aria-current')
  })

  /** What a session is doing now matters more than when it last changed. */
  it('says a working session is working instead of when it changed', async () => {
    invoked.result = [summary({ id: 'a', title: 'busy', path: '/sessions/a.jsonl' })]

    render(<PrimeSessionList now={NOW} activeSessionPath="/sessions/a.jsonl" working />)

    expect(await screen.findByText('Working · tools')).toBeInTheDocument()
  })

  it('explains an empty list instead of rendering nothing', async () => {
    render(<PrimeSessionList now={NOW} />)

    expect(await screen.findByText(/No Prime sessions yet/)).toBeInTheDocument()
  })

  it('surfaces a read failure instead of looking empty', async () => {
    invoked.fail = 'permission denied'

    render(<PrimeSessionList now={NOW} />)

    expect(await screen.findByRole('alert')).toHaveTextContent(/permission denied/)
  })

  it('reports the list size in buckets and the age of what was opened', async () => {
    invoked.result = [summary({ id: 'a', title: 'pick me', mtimeMs: NOW - 3 * DAY })]

    render(<PrimeSessionList now={NOW} />)
    fireEvent.click(await screen.findByRole('button', { name: /pick me/ }))

    await waitFor(() => expect(tracked.opened).toEqual([1]))
    expect(tracked.selected).toEqual(['week'])
  })

  it('offers a new chat only when the caller can start one', async () => {
    const onNewChat = vi.fn()
    const { rerender } = render(<PrimeSessionList now={NOW} onNewChat={onNewChat} />)

    fireEvent.click(await screen.findByRole('button', { name: 'New chat' }))
    expect(onNewChat).toHaveBeenCalled()

    rerender(<PrimeSessionList now={NOW} />)
    expect(screen.queryByRole('button', { name: 'New chat' })).not.toBeInTheDocument()
  })
})
