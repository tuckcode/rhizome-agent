import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PrimeSessionList from './PrimeSessionList'
import type { PrimeSessionSummary } from '../lib/primeSessionMeta'

const invoked = vi.hoisted(() => ({
  calls: [] as string[],
  args: [] as Array<Record<string, unknown> | undefined>,
  result: [] as unknown[],
  roster: [] as unknown[],
  rosterFails: false,
  fail: '',
}))

vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: (cmd: string, args?: Record<string, unknown>) => {
    invoked.calls.push(cmd)
    invoked.args.push(args)
    if (cmd === 'list_prime_running_sessions') {
      return invoked.rosterFails
        ? Promise.reject(new Error('daemon unreachable'))
        : Promise.resolve(invoked.roster)
    }
    if (invoked.fail) return Promise.reject(new Error(invoked.fail))
    return Promise.resolve(invoked.result)
  },
}))

const tracked = vi.hoisted(() => ({
  opened: [] as number[],
  selected: [] as string[],
  archived: [] as boolean[],
  filtered: [] as number[],
  renamed: 0,
}))
vi.mock('../lib/productAnalytics', () => ({
  trackPrimeSessionListOpened: (count: number) => tracked.opened.push(count),
  trackPrimeSessionOpened: (age: string) => tracked.selected.push(age),
  trackPrimeSessionArchived: (archived: boolean) => tracked.archived.push(archived),
  trackPrimeSessionListFiltered: (count: number) => tracked.filtered.push(count),
  trackPrimeSessionRenamed: () => {
    tracked.renamed += 1
  },
}))

const NOW = new Date(2026, 7, 13, 15, 0, 0).getTime()
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

function summary(overrides: Partial<PrimeSessionSummary> = {}): PrimeSessionSummary {
  return { id: 'id-1', path: '/sessions/id-1.jsonl', mtimeMs: NOW - HOUR, ...overrides }
}

beforeEach(() => {
  invoked.calls = []
  invoked.args = []
  invoked.result = []
  invoked.roster = []
  invoked.rosterFails = false
  invoked.fail = ''
  tracked.opened = []
  tracked.selected = []
  tracked.archived = []
  tracked.filtered = []
  tracked.renamed = 0
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

  /**
   * #30's second item. The list reads every log in `~/.prime/agent/sessions`
   * whoever wrote it — 28 of the author's 93 ran in a temp directory, from
   * test runs — and nothing on a row said so.
   *
   * Rows from the open vault stay quiet: repeating its name on every row is
   * noise on the common case.
   */
  it('says where a session ran when that is not the vault in front of you', async () => {
    const vault = '/Users/dtc/Documents/Rhizome Vault'
    invoked.result = [
      summary({ id: 'a', path: '/sessions/a.jsonl', title: 'Here', cwd: vault }),
      summary({ id: 'b', path: '/sessions/b.jsonl', title: 'Elsewhere', cwd: '/private/tmp' }),
    ]

    render(<PrimeSessionList onSelect={vi.fn()} locale="en" now={NOW} vaultPath={vault} />)

    expect(await screen.findByText('Elsewhere')).toBeInTheDocument()
    expect(screen.getByText('Today · 14:00 · tmp')).toBeInTheDocument()
    expect(screen.getByText('Today · 14:00')).toBeInTheDocument()
  })

  it('names every place when it has no vault to compare against', async () => {
    invoked.result = [
      summary({
        id: 'a',
        path: '/sessions/a.jsonl',
        title: 'Somewhere',
        cwd: '/Users/dtc/code/projects/rhizome-agent',
      }),
    ]

    render(<PrimeSessionList onSelect={vi.fn()} locale="en" now={NOW} />)

    expect(await screen.findByText('Today · 14:00 · rhizome-agent')).toBeInTheDocument()
  })

  describe('running vs saved', () => {
    /**
     * Sessions outlive the window (ADR-0163) and several run at once (#13),
     * so "I left this running" and "this is finished" are different answers
     * and the list used to give both the same dot — it only ever lit the
     * session this window was attached to.
     *
     * Asserted on the accessible name rather than the dot's classes: the dot
     * is `aria-hidden`, so a class assertion would prove the pixel changed
     * while a screen reader still heard four identical rows.
     */
    it('says which sessions the daemon still holds, and which are turning', async () => {
      invoked.result = [
        summary({ id: 'a', path: '/sessions/a.jsonl', title: 'Turning' }),
        summary({ id: 'b', path: '/sessions/b.jsonl', title: 'Idle but alive' }),
        summary({ id: 'c', path: '/sessions/c.jsonl', title: 'Just a log' }),
      ]
      invoked.roster = [
        { id: 'r1', activeSessionId: 'r1', sessionFile: '/sessions/a.jsonl', activity: 'working' },
        { id: 'r2', activeSessionId: 'r2', sessionFile: '/sessions/b.jsonl', activity: 'idle' },
      ]

      render(<PrimeSessionList onSelect={vi.fn()} locale="en" now={NOW} />)

      expect(
        await screen.findByRole('button', { name: 'Open session Turning — working now' }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Open session Idle but alive — still running' }),
      ).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Open session Just a log' })).toBeInTheDocument()
    })

    /** The daemon being unreachable is ordinary; it must not read as "all dead" loudly. */
    it('falls back to saved when the roster cannot be read', async () => {
      invoked.result = [summary({ id: 'a', path: '/sessions/a.jsonl', title: 'Unknown' })]
      invoked.rosterFails = true

      render(<PrimeSessionList onSelect={vi.fn()} locale="en" now={NOW} />)

      expect(await screen.findByRole('button', { name: 'Open session Unknown' })).toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })

  describe('archiving', () => {
    /**
     * Archiving is Rhizome's own view: `~/.prime/agent/sessions` belongs to
     * Prime and is shared with its CLI, so a filed session is flagged in
     * settings and never moved or deleted on disk. The row leaves the main
     * list and the archive disclosure appears.
     */
    it('files a session out of the list and tells the host', async () => {
      invoked.result = [
        summary({ id: 'a', path: '/sessions/a.jsonl', title: 'Keep me' }),
        summary({ id: 'b', path: '/sessions/b.jsonl', title: 'File me' }),
      ]

      render(<PrimeSessionList onSelect={vi.fn()} locale="en" now={NOW} />)

      fireEvent.click(await screen.findByRole('button', { name: 'Archive File me' }))

      await waitFor(() => expect(screen.queryByText('File me')).not.toBeInTheDocument())
      expect(screen.getByText('Keep me')).toBeInTheDocument()
      expect(invoked.calls).toContain('set_prime_session_archived')
    })

    it('shows what is archived behind a disclosure, closed to start', async () => {
      invoked.result = [
        summary({ id: 'a', path: '/sessions/a.jsonl', title: 'Live one' }),
        summary({ id: 'b', path: '/sessions/b.jsonl', title: 'Filed one', archived: true }),
      ]

      render(<PrimeSessionList onSelect={vi.fn()} locale="en" now={NOW} />)

      expect(await screen.findByText('Live one')).toBeInTheDocument()
      expect(screen.queryByText('Filed one')).not.toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: /Archived/ }))

      expect(screen.getByText('Filed one')).toBeInTheDocument()
    })

    it('has no archive section at all when nothing is filed', async () => {
      invoked.result = [summary({ id: 'a', path: '/sessions/a.jsonl', title: 'Only one' })]

      render(<PrimeSessionList onSelect={vi.fn()} locale="en" now={NOW} />)

      await screen.findByText('Only one')
      expect(screen.queryByRole('button', { name: /Archived/ })).not.toBeInTheDocument()
    })

    it('puts a session back', async () => {
      invoked.result = [
        summary({ id: 'b', path: '/sessions/b.jsonl', title: 'Filed one', archived: true }),
      ]

      render(<PrimeSessionList onSelect={vi.fn()} locale="en" now={NOW} />)

      fireEvent.click(await screen.findByRole('button', { name: /Archived/ }))
      fireEvent.click(screen.getByRole('button', { name: 'Restore Filed one' }))

      await waitFor(() =>
        expect(screen.queryByRole('button', { name: /Archived/ })).not.toBeInTheDocument(),
      )
      expect(screen.getByText('Filed one')).toBeInTheDocument()
    })

    /**
     * The row moves before the host answers, so a refusal has to move it back
     * — otherwise the list quietly disagrees with what is stored, and the
     * next reload appears to lose the user's action.
     */
    it('puts the row back when the host refuses', async () => {
      invoked.result = [summary({ id: 'b', path: '/sessions/b.jsonl', title: 'File me' })]

      render(<PrimeSessionList onSelect={vi.fn()} locale="en" now={NOW} />)
      await screen.findByText('File me')
      invoked.fail = 'settings are read-only'

      fireEvent.click(screen.getByRole('button', { name: 'Archive File me' }))

      expect(await screen.findByRole('alert')).toBeInTheDocument()
      expect(screen.getByText('File me')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Archived/ })).not.toBeInTheDocument()
    })
  })

  describe('renaming', () => {
    /**
     * #31. The list is where a name is given, not a place that waits for the
     * first message to invent one. The title moves first; the host is told
     * the log path and the new name — `rename_saved_session`, not the
     * live-session `set_session_name`.
     */
    it('renames a session from the list and tells the host', async () => {
      invoked.result = [summary({ id: 'a', path: '/sessions/a.jsonl', title: 'File me' })]

      render(<PrimeSessionList onSelect={vi.fn()} locale="en" now={NOW} />)
      fireEvent.click(await screen.findByRole('button', { name: 'Rename File me' }))

      const input = screen.getByTestId('prime-session-rename')
      fireEvent.change(input, { target: { value: 'Inbox triage' } })
      fireEvent.keyDown(input, { key: 'Enter' })

      expect(await screen.findByText('Inbox triage')).toBeInTheDocument()
      expect(invoked.calls).toContain('rename_prime_session')
      expect(invoked.args).toContainEqual({ path: '/sessions/a.jsonl', name: 'Inbox triage' })
      expect(tracked.renamed).toBe(1)
    })

    it('does not send a blank name, and unnamed sessions still fall back', async () => {
      invoked.result = [summary({ id: 'a', path: '/sessions/a.jsonl', title: null })]

      render(<PrimeSessionList onSelect={vi.fn()} locale="en" now={NOW} />)
      expect(await screen.findByText('Untitled session')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Rename Untitled session' }))
      fireEvent.change(screen.getByTestId('prime-session-rename'), { target: { value: '   ' } })
      fireEvent.keyDown(screen.getByTestId('prime-session-rename'), { key: 'Enter' })

      expect(await screen.findByText('Untitled session')).toBeInTheDocument()
      expect(invoked.calls).not.toContain('rename_prime_session')
      expect(tracked.renamed).toBe(0)
    })

    it('puts the previous title back when the host refuses', async () => {
      invoked.result = [summary({ id: 'a', path: '/sessions/a.jsonl', title: 'Keep me' })]

      render(<PrimeSessionList onSelect={vi.fn()} locale="en" now={NOW} />)
      fireEvent.click(await screen.findByRole('button', { name: 'Rename Keep me' }))
      invoked.fail = 'daemon refused'
      fireEvent.change(screen.getByTestId('prime-session-rename'), {
        target: { value: 'New name' },
      })
      fireEvent.keyDown(screen.getByTestId('prime-session-rename'), { key: 'Enter' })

      expect(await screen.findByRole('alert')).toBeInTheDocument()
      expect(screen.getByText('Keep me')).toBeInTheDocument()
    })

    it('cancels without talking to the host', async () => {
      invoked.result = [summary({ id: 'a', path: '/sessions/a.jsonl', title: 'Keep me' })]

      render(<PrimeSessionList onSelect={vi.fn()} locale="en" now={NOW} />)
      fireEvent.click(await screen.findByRole('button', { name: 'Rename Keep me' }))
      fireEvent.change(screen.getByTestId('prime-session-rename'), {
        target: { value: 'Changed my mind' },
      })
      fireEvent.keyDown(screen.getByTestId('prime-session-rename'), { key: 'Escape' })

      expect(await screen.findByText('Keep me')).toBeInTheDocument()
      expect(invoked.calls).not.toContain('rename_prime_session')
    })
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
    fireEvent.click(await screen.findByRole('button', { name: 'Open session pick me' }))

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

    const active = await screen.findByRole('button', { name: 'Open session active one' })
    expect(active).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('button', { name: 'Open session other one' })).not.toHaveAttribute(
      'aria-current',
    )
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
    fireEvent.click(await screen.findByRole('button', { name: 'Open session pick me' }))

    await waitFor(() => expect(tracked.opened).toEqual([1]))
    expect(tracked.selected).toEqual(['week'])
  })

  it('filters the list by title and says when nothing matches', async () => {
    invoked.result = [
      summary({ id: 'a', title: 'Vault watcher' }),
      summary({ id: 'b', title: 'Release notes' }),
    ]

    render(<PrimeSessionList now={NOW} />)
    const search = await screen.findByRole('textbox', { name: 'Filter sessions' })
    fireEvent.change(search, { target: { value: 'vault' } })

    expect(screen.getByRole('button', { name: 'Open session Vault watcher' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Open session Release notes' })).not.toBeInTheDocument()
    expect(tracked.filtered).toEqual([1])

    fireEvent.change(search, { target: { value: 'nope' } })
    expect(screen.getByText('No sessions match.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Open session/ })).not.toBeInTheDocument()
  })

  it('searches archived rows instead of silently hiding them', async () => {
    invoked.result = [
      summary({ id: 'a', title: 'Live vault work' }),
      summary({ id: 'b', title: 'Old vault watcher', archived: true }),
    ]

    render(<PrimeSessionList now={NOW} />)
    await screen.findByText('Live vault work')
    expect(screen.queryByText('Old vault watcher')).not.toBeInTheDocument()

    fireEvent.change(screen.getByRole('textbox', { name: 'Filter sessions' }), {
      target: { value: 'watcher' },
    })

    expect(await screen.findByText('Old vault watcher')).toBeInTheDocument()
    expect(screen.queryByText('Live vault work')).not.toBeInTheDocument()
  })

  it('keeps the empty-store copy distinct from a failed search', async () => {
    render(<PrimeSessionList now={NOW} />)

    expect(await screen.findByText(/No Prime sessions yet/)).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Filter sessions' })).not.toBeInTheDocument()
    expect(screen.queryByText('No sessions match.')).not.toBeInTheDocument()
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

describe('PrimeSessionList — scratch sessions', () => {
  /**
   * 41 of 136 saved sessions on one real machine ran in a temp directory:
   * test runs and probes, each creating a real session in Prime's shared
   * store. They outnumbered the vault's own sessions in the recent list and
   * are named after the temp folder — `Rhizome · .tmpwkDuS · a1b2c3`.
   */
  it('keeps temp-directory sessions out of the main list', async () => {
    invoked.result = [
      summary({ id: 'real', path: '/sessions/real.jsonl', title: 'Where does the watcher debounce?' }),
      summary({ id: 'junk', path: '/sessions/junk.jsonl', title: 'Rhizome · .tmpwkDuS · a1b2c3', scratch: true }),
    ]

    render(<PrimeSessionList onSelect={vi.fn()} locale="en" now={NOW} />)

    expect(await screen.findByText('Where does the watcher debounce?')).toBeInTheDocument()
    expect(screen.queryByText('Rhizome · .tmpwkDuS · a1b2c3')).not.toBeInTheDocument()
  })

  /** Separate, not gone — the same rule the rest of this app follows. */
  it('still finds a scratch session by search', async () => {
    invoked.result = [
      summary({ id: 'real', path: '/sessions/real.jsonl', title: 'Where does the watcher debounce?' }),
      summary({ id: 'junk', path: '/sessions/junk.jsonl', title: 'Rhizome · .tmpwkDuS · a1b2c3', scratch: true }),
    ]

    render(<PrimeSessionList onSelect={vi.fn()} locale="en" now={NOW} />)
    await screen.findByText('Where does the watcher debounce?')

    fireEvent.change(screen.getByTestId('prime-session-search'), {
      target: { value: 'tmpwkDuS' },
    })

    expect(await screen.findByText('Rhizome · .tmpwkDuS · a1b2c3')).toBeInTheDocument()
  })
})

describe('PrimeSessionList — macOS title bar gutter', () => {
  it('reserves traffic-light space on the header when it is the top band', () => {
    render(<PrimeSessionList locale="en" titleBarGutter />)

    const header = screen.getByTestId('prime-session-list-header')
    expect(header.className).toContain('pl-[var(--subhead-traffic-light-inset')
    expect(header).not.toHaveClass('h-10')
  })
})
