import { describe, expect, it } from 'vitest'
import {
  isRosterSessionRunning,
  rosterSessionTitle,
  runningSessionOverflow,
  toRunningSessionRows,
  type PrimeRosterSession,
} from './primeRunningSessions'

/**
 * Fixtures mirror the shape observed live from `prime-agent` 0.7.2's daemon
 * `list` command (protocol 7), not the shape its `.d.ts` advertises. The
 * difference matters: `sessionName` is declared optional and is absent from
 * every live session, so a fixture that sets it would test a field the app
 * never receives.
 */
function session(overrides: Partial<PrimeRosterSession> = {}): PrimeRosterSession {
  return {
    id: 'aaa1',
    activeSessionId: 'aaa1',
    sessionId: '01a00dea-98f3-773a-b1f6-54ed0f07736e',
    cwd: '/Users/dtc/code/projects/rhizome-agent',
    lifecycle: 'live',
    activity: 'idle',
    isSessionActive: false,
    runtimeKind: 'top-level',
    rlmDepth: 0,
    isStreaming: false,
    isCompacting: false,
    isBashRunning: false,
    isRunningTools: false,
    hasRunningRlmChildren: false,
    attachedClients: 0,
    messageCount: 4,
    lastActivityAt: '2026-08-19T22:22:25.831Z',
    ...overrides,
  }
}

describe('isRosterSessionRunning', () => {
  // Mirrors Prime's own classifySessionRosterStatus rather than inventing a
  // second definition of "running" that could drift from the daemon's.
  it('treats a working session as running', () => {
    expect(isRosterSessionRunning(session({ activity: 'working' }))).toBe(true)
  })

  it('treats an idle session as not running', () => {
    expect(isRosterSessionRunning(session({ activity: 'idle' }))).toBe(false)
  })

  it('treats an idle session with running subagents as running', () => {
    // The parent shows idle while its children work; the user still has work
    // in flight, so "is anything working?" must answer yes.
    expect(isRosterSessionRunning(session({ activity: 'idle', hasRunningRlmChildren: true }))).toBe(true)
  })

  it('treats an active session as running even when activity says idle', () => {
    expect(isRosterSessionRunning(session({ activity: 'idle', isSessionActive: true }))).toBe(true)
  })

  it('treats a live heartbeat as running', () => {
    expect(isRosterSessionRunning(session({ activity: 'idle', hasActiveHeartbeat: true }))).toBe(true)
  })

  it('treats a session with no activeSessionId as inactive', () => {
    expect(isRosterSessionRunning(session({ activeSessionId: undefined, activity: 'working' }))).toBe(false)
  })
})

describe('rosterSessionTitle', () => {
  it('falls back to firstMessage because live sessions carry no sessionName', () => {
    expect(rosterSessionTitle(session({ firstMessage: 'Fix the note list refresh bug' })))
      .toBe('Fix the note list refresh bug')
  })

  it('prefers sessionName when the daemon does supply one', () => {
    expect(rosterSessionTitle(session({ sessionName: 'C29', firstMessage: 'Fix the note list' })))
      .toBe('C29')
  })

  it('collapses whitespace and newlines from a pasted first message', () => {
    expect(rosterSessionTitle(session({ firstMessage: 'Pickup —\n\n  Rhizome   Agent' })))
      .toBe('Pickup — Rhizome Agent')
  })

  it('truncates a long first message on a word boundary', () => {
    const title = rosterSessionTitle(
      session({ firstMessage: 'a'.repeat(20) + ' ' + 'b'.repeat(80) }),
      { maxLength: 30 },
    )
    expect(title.length).toBeLessThanOrEqual(31)
    expect(title.endsWith('…')).toBe(true)
  })

  it('falls back to the working directory name when there is no message', () => {
    expect(rosterSessionTitle(session({ firstMessage: undefined, cwd: '/Users/dtc/code/projects/rhizome-agent' })))
      .toBe('rhizome-agent')
  })

  it('falls back to the short id when there is neither message nor cwd', () => {
    expect(rosterSessionTitle(session({ firstMessage: undefined, cwd: undefined, id: 'aaa1' })))
      .toBe('aaa1')
  })
})

describe('toRunningSessionRows', () => {
  it('renders nothing when nothing is running', () => {
    expect(toRunningSessionRows([session({ activity: 'idle' })])).toEqual([])
  })

  it('tolerates a missing or malformed roster', () => {
    expect(toRunningSessionRows(undefined)).toEqual([])
    expect(toRunningSessionRows([null as unknown as PrimeRosterSession])).toEqual([])
  })

  it('lists a running top-level session', () => {
    const rows = toRunningSessionRows([
      session({ activity: 'working', firstMessage: 'Ship the menu bar roster' }),
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe('aaa1')
    expect(rows[0].title).toBe('Ship the menu bar roster')
    expect(rows[0].working).toBe(true)
  })

  it('omits subagents from the list and counts them on their root instead', () => {
    const rows = toRunningSessionRows([
      session({ id: 'root', activeSessionId: 'root', activity: 'working' }),
      session({ id: 'kid1', activeSessionId: 'kid1', runtimeKind: 'subagent', rlmDepth: 1, parentActiveSessionId: 'root' }),
      session({ id: 'kid2', activeSessionId: 'kid2', runtimeKind: 'subagent', rlmDepth: 1, parentActiveSessionId: 'root' }),
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe('root')
    expect(rows[0].subagentCount).toBe(2)
  })

  it('counts grandchildren too, because the dropdown shows a count and not a tree', () => {
    const rows = toRunningSessionRows([
      session({ id: 'root', activeSessionId: 'root', activity: 'working' }),
      session({ id: 'kid', activeSessionId: 'kid', runtimeKind: 'subagent', rlmDepth: 1, parentActiveSessionId: 'root' }),
      session({ id: 'grandkid', activeSessionId: 'grandkid', runtimeKind: 'subagent', rlmDepth: 2, parentActiveSessionId: 'kid' }),
    ])
    expect(rows[0].subagentCount).toBe(2)
  })

  it('does not attribute one root\'s subagents to another root', () => {
    const rows = toRunningSessionRows([
      session({ id: 'rootA', activeSessionId: 'rootA', activity: 'working' }),
      session({ id: 'rootB', activeSessionId: 'rootB', activity: 'working' }),
      session({ id: 'kid', activeSessionId: 'kid', runtimeKind: 'subagent', rlmDepth: 1, parentActiveSessionId: 'rootB' }),
    ])
    const byId = Object.fromEntries(rows.map((row) => [row.id, row.subagentCount]))
    expect(byId).toEqual({ rootA: 0, rootB: 1 })
  })

  it('keeps an orphaned subagent out of the list rather than promoting it', () => {
    // A child whose parent already left the roster must not appear as a
    // top-level row — that would read as a session the user never started.
    const rows = toRunningSessionRows([
      session({ id: 'orphan', activeSessionId: 'orphan', runtimeKind: 'subagent', rlmDepth: 1, parentActiveSessionId: 'gone', activity: 'working' }),
    ])
    expect(rows).toEqual([])
  })

  it('prefers the daemon summary as the activity line', () => {
    const rows = toRunningSessionRows([
      session({ activity: 'working', summary: 'Reading the vault loader' }),
    ])
    expect(rows[0].activityLabel).toBe('Reading the vault loader')
  })

  it('describes what it is doing when the daemon has no summary yet', () => {
    const compacting = toRunningSessionRows([session({ activity: 'working', isCompacting: true })])
    expect(compacting[0].activityLabel).toBe('Compacting')

    const bash = toRunningSessionRows([session({ activity: 'working', isBashRunning: true })])
    expect(bash[0].activityLabel).toBe('Running a command')

    const tools = toRunningSessionRows([session({ activity: 'working', isRunningTools: true })])
    expect(tools[0].activityLabel).toBe('Running tools')

    const streaming = toRunningSessionRows([session({ activity: 'working', isStreaming: true })])
    expect(streaming[0].activityLabel).toBe('Replying')

    const bare = toRunningSessionRows([session({ activity: 'working' })])
    expect(bare[0].activityLabel).toBe('Working')
  })

  it('reports waiting on subagents when only the children are busy', () => {
    const rows = toRunningSessionRows([
      session({ id: 'root', activeSessionId: 'root', activity: 'idle', hasRunningRlmChildren: true }),
      session({ id: 'kid', activeSessionId: 'kid', runtimeKind: 'subagent', rlmDepth: 1, parentActiveSessionId: 'root' }),
    ])
    expect(rows[0].activityLabel).toBe('Waiting on subagents')
  })

  it('collapses a multi-line summary to one line', () => {
    const rows = toRunningSessionRows([
      session({ activity: 'working', summary: 'Reading\nthe   loader' }),
    ])
    expect(rows[0].activityLabel).toBe('Reading the loader')
  })

  it('sorts working sessions above merely-busy ones, then by recency', () => {
    const rows = toRunningSessionRows([
      session({ id: 'old', activeSessionId: 'old', activity: 'working', lastActivityAt: '2026-08-19T10:00:00.000Z' }),
      session({ id: 'new', activeSessionId: 'new', activity: 'working', lastActivityAt: '2026-08-19T22:00:00.000Z' }),
      session({ id: 'waiting', activeSessionId: 'waiting', activity: 'idle', hasActiveHeartbeat: true, lastActivityAt: '2026-08-19T23:00:00.000Z' }),
    ])
    expect(rows.map((row) => row.id)).toEqual(['new', 'old', 'waiting'])
  })

  it('caps the list so the popover cannot grow without bound', () => {
    const many = Array.from({ length: 12 }, (_, index) =>
      session({ id: `s${index}`, activeSessionId: `s${index}`, activity: 'working' }),
    )
    expect(toRunningSessionRows(many)).toHaveLength(5)
    expect(toRunningSessionRows(many, { limit: 2 })).toHaveLength(2)
  })

  it('reports how many running sessions were hidden by the cap', () => {
    const many = Array.from({ length: 7 }, (_, index) =>
      session({ id: `s${index}`, activeSessionId: `s${index}`, activity: 'working' }),
    )
    expect(runningSessionOverflow(many, 5)).toBe(2)
  })
})
