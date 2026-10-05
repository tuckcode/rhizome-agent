import { describe, expect, it } from 'vitest'
import {
  ROSTER_ACTIVITY_KEYS,
  familyForRoot,
  isRosterSessionRunning,
  rosterActivityMessageKey,
  rosterSessionTitle,
  runningSessionFilesByPath,
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
    cwd: '/Users/jdoe/code/projects/rhizome-agent',
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
    expect(rosterSessionTitle(session({ firstMessage: undefined, cwd: '/Users/jdoe/code/projects/rhizome-agent' })))
      .toBe('rhizome-agent')
  })

  it('falls back to the short id when there is neither message nor cwd', () => {
    expect(rosterSessionTitle(session({ firstMessage: undefined, cwd: undefined, id: 'aaa1' })))
      .toBe('aaa1')
  })
})

describe('familyForRoot', () => {
  it('is empty when the live session has no children', () => {
    expect(familyForRoot([session()], 'aaa1')).toEqual([])
  })

  it('lists the live session\'s descendants and not another root\'s', () => {
    const members = familyForRoot(
      [
        session({ id: 'root', activeSessionId: 'root' }),
        session({
          id: 'kid',
          activeSessionId: 'kid',
          runtimeKind: 'subagent',
          rlmDepth: 1,
          parentActiveSessionId: 'root',
          firstMessage: 'Review auth',
          activity: 'working',
          isSessionActive: true,
        }),
        session({
          id: 'other-kid',
          activeSessionId: 'other-kid',
          runtimeKind: 'subagent',
          rlmDepth: 1,
          parentActiveSessionId: 'elsewhere',
          firstMessage: 'Not ours',
        }),
      ],
      'root',
    )

    expect(members.map((member) => member.id)).toEqual(['kid'])
    expect(members[0]?.title).toBe('Review auth')
    expect(members[0]?.working).toBe(true)
  })

  it('includes grandchildren under the same root', () => {
    const members = familyForRoot(
      [
        session({ id: 'root', activeSessionId: 'root' }),
        session({
          id: 'kid',
          activeSessionId: 'kid',
          runtimeKind: 'subagent',
          rlmDepth: 1,
          parentActiveSessionId: 'root',
        }),
        session({
          id: 'grandkid',
          activeSessionId: 'grandkid',
          runtimeKind: 'subagent',
          rlmDepth: 2,
          parentActiveSessionId: 'kid',
        }),
      ],
      'root',
    )

    expect(members.map((member) => member.id)).toEqual(['kid', 'grandkid'])
    expect(members.find((member) => member.id === 'grandkid')?.depth).toBe(2)
  })

  it('is empty without a live session handle', () => {
    expect(
      familyForRoot(
        [
          session({
            id: 'kid',
            activeSessionId: 'kid',
            runtimeKind: 'subagent',
            parentActiveSessionId: 'root',
          }),
        ],
        null,
      ),
    ).toEqual([])
  })

  it('matches Chat\'s durable sessionId, not only the daemon handle', () => {
    const members = familyForRoot(
      [
        session({
          id: 'handle-root',
          activeSessionId: 'handle-root',
          sessionId: '019fe641-61fa-73e9-82ef-91fc90097aab',
        }),
        session({
          id: 'child-node-9',
          activeSessionId: 'handle-kid',
          rlmChildId: 'child-node-9',
          runtimeKind: 'subagent',
          rlmDepth: 1,
          parentActiveSessionId: 'handle-root',
          firstMessage: 'Review auth',
        }),
      ],
      '019fe641-61fa-73e9-82ef-91fc90097aab',
    )

    expect(members.map((member) => member.id)).toEqual(['child-node-9'])
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
    expect(rows[0].activity).toEqual({ kind: 'summary', text: 'Reading the vault loader' })
  })

  it('describes what it is doing when the daemon has no summary yet', () => {
    const compacting = toRunningSessionRows([session({ activity: 'working', isCompacting: true })])
    expect(compacting[0].activity).toEqual({ kind: 'status', key: 'compacting' })

    const bash = toRunningSessionRows([session({ activity: 'working', isBashRunning: true })])
    expect(bash[0].activity).toEqual({ kind: 'status', key: 'runningCommand' })

    const tools = toRunningSessionRows([session({ activity: 'working', isRunningTools: true })])
    expect(tools[0].activity).toEqual({ kind: 'status', key: 'runningTools' })

    const streaming = toRunningSessionRows([session({ activity: 'working', isStreaming: true })])
    expect(streaming[0].activity).toEqual({ kind: 'status', key: 'replying' })

    const bare = toRunningSessionRows([session({ activity: 'working' })])
    expect(bare[0].activity).toEqual({ kind: 'status', key: 'working' })
  })

  it('reports waiting on subagents when only the children are busy', () => {
    const rows = toRunningSessionRows([
      session({ id: 'root', activeSessionId: 'root', activity: 'idle', hasRunningRlmChildren: true }),
      session({ id: 'kid', activeSessionId: 'kid', runtimeKind: 'subagent', rlmDepth: 1, parentActiveSessionId: 'root' }),
    ])
    expect(rows[0].activity).toEqual({ kind: 'status', key: 'waitingOnSubagents' })
  })

  it('collapses a multi-line summary to one line', () => {
    const rows = toRunningSessionRows([
      session({ activity: 'working', summary: 'Reading\nthe   loader' }),
    ])
    expect(rows[0].activity).toEqual({ kind: 'summary', text: 'Reading the loader' })
  })

  it('sorts working sessions above merely-busy ones, then by recency', () => {
    const rows = toRunningSessionRows([
      session({ id: 'old', activeSessionId: 'old', activity: 'working', lastActivityAt: '2026-08-19T10:00:00.000Z' }),
      session({ id: 'new', activeSessionId: 'new', activity: 'working', lastActivityAt: '2026-08-19T22:00:00.000Z' }),
      session({ id: 'waiting', activeSessionId: 'waiting', activity: 'idle', hasActiveHeartbeat: true, lastActivityAt: '2026-08-19T23:00:00.000Z' }),
    ])
    expect(rows.map((row) => row.id)).toEqual(['new', 'old', 'waiting'])
  })

  it('disambiguates rows that would otherwise render the same title', () => {
    // Seen live: four running sessions, none with a firstMessage, two of them
    // rooted at /Users/jdoe. Both rows rendered "jdoe" and the user had no way
    // to tell which was which -- or that they were different sessions at all.
    const rows = toRunningSessionRows([
      session({ id: 'aaa1bbb2ccc3', activeSessionId: 'aaa1bbb2ccc3', activity: 'working', firstMessage: undefined, cwd: '/Users/jdoe' }),
      session({ id: 'ddd4eee5fff6', activeSessionId: 'ddd4eee5fff6', activity: 'working', firstMessage: undefined, cwd: '/Users/jdoe' }),
    ])
    expect(rows).toHaveLength(2)
    expect(rows[0].title).not.toBe(rows[1].title)
    expect(rows[0].title.startsWith('jdoe')).toBe(true)
    expect(rows[1].title.startsWith('jdoe')).toBe(true)
  })

  it('leaves a unique title alone', () => {
    const rows = toRunningSessionRows([
      session({ id: 'aaa1', activeSessionId: 'aaa1', activity: 'working', firstMessage: undefined, cwd: '/Users/jdoe' }),
      session({ id: 'bbb2', activeSessionId: 'bbb2', activity: 'working', firstMessage: undefined, cwd: '/repo/demo-vault-v2' }),
    ])
    expect(rows.map((row) => row.title).sort()).toEqual(['demo-vault-v2', 'jdoe'])
  })

  it('disambiguates duplicate first messages too, not just cwd fallbacks', () => {
    const rows = toRunningSessionRows([
      session({ id: 'aaa1', activeSessionId: 'aaa1', activity: 'working', firstMessage: 'Pickup' }),
      session({ id: 'bbb2', activeSessionId: 'bbb2', activity: 'working', firstMessage: 'Pickup' }),
    ])
    expect(rows[0].title).not.toBe(rows[1].title)
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

/**
 * Probed live against 0.7.4 on 2026-08-20: `firstMessage` is the *composed*
 * prompt Rhizome sends, so every Rhizome session's first message begins
 * "System instructions: You are working inside Rhizome…". Titled from it raw,
 * every row in the popover reads the same sentence.
 *
 * `prime_sessions.rs` already fixed exactly this for the history list (C26).
 * The roster is the second surface with the same input and never got the fix.
 */
describe('a roster title is the user’s words, not the system block', () => {
  const composed =
    'System instructions:\nYou are working inside Rhizome, a local-first Markdown ' +
    'knowledge base.\n\nUser request:\nhow do I link two notes?'

  it('strips the composed prompt down to what the user typed', () => {
    expect(rosterSessionTitle({ activeSessionId: 'a', firstMessage: composed })).toBe(
      'how do I link two notes?',
    )
  })

  it('leaves a plain first message alone', () => {
    expect(
      rosterSessionTitle({ activeSessionId: 'a', firstMessage: 'just a question' }),
    ).toBe('just a question')
  })

  it('keeps two sessions distinguishable when both were composed', () => {
    const rows = toRunningSessionRows([
      {
        activeSessionId: 'one',
        activity: 'working',
        firstMessage: `${composed}`,
      },
      {
        activeSessionId: 'two',
        activity: 'working',
        firstMessage:
          'System instructions:\nYou are working inside Rhizome, a local-first Markdown ' +
          'knowledge base.\n\nUser request:\nsummarise today’s notes',
      },
    ])
    expect(rows.map((row) => row.title)).toEqual([
      'how do I link two notes?',
      'summarise today’s notes',
    ])
  })
})

/**
 * `taskState` is sent by 0.7.4 (values `needs_input` and `completed`) and was
 * absent from this module's interface, so a session sitting waiting for the
 * user fell through every branch and rendered as "Working" — the one thing it
 * is not doing.
 */
describe('a session waiting on the user does not claim to be working', () => {
  it('says it is waiting rather than working', () => {
    const rows = toRunningSessionRows([
      {
        activeSessionId: 'waiting',
        // Counted as running because the session is held open, but the agent
        // is not turning: no stream, no tools, no compaction, no children.
        // This is the case that fell through every branch to "Working".
        isSessionActive: true,
        activity: 'idle',
        taskState: 'needs_input',
        firstMessage: 'check the deploy',
      },
    ])
    expect(rows[0]?.activity).toEqual({ kind: 'status', key: 'waitingForYou' })
  })

  it('prefers the heartbeat explanation, which says more', () => {
    const rows = toRunningSessionRows([
      {
        activeSessionId: 'beating',
        hasActiveHeartbeat: true,
        activity: 'idle',
        taskState: 'needs_input',
        firstMessage: 'check the deploy',
      },
    ])
    expect(rows[0]?.activity).toEqual({ kind: 'status', key: 'waitingOnHeartbeat' })
  })

  it('still reports real work when the agent is turning', () => {
    const rows = toRunningSessionRows([
      {
        activeSessionId: 'busy',
        activity: 'working',
        isStreaming: true,
        taskState: 'needs_input',
        firstMessage: 'check the deploy',
      },
    ])
    expect(rows[0]?.activity).toEqual({ kind: 'status', key: 'replying' })
  })
})

/**
 * C34. Every status this module produced was an English literal, so the
 * popover stayed English in every locale. The module is pure and has no
 * translator, so it names the status and the view supplies the words.
 */
describe('activity statuses are named, not written', () => {
  it('gives every known status a key the locale file can translate', () => {
    const keys = ROSTER_ACTIVITY_KEYS
    expect(new Set(keys).size).toBe(keys.length)
    for (const key of keys) {
      expect(rosterActivityMessageKey(key)).toBe(`menuBarCompanion.activity.${key}`)
    }
  })

  it('passes the daemon’s own summary through as prose, not a key', () => {
    const rows = toRunningSessionRows([
      { activeSessionId: 'a', activity: 'working', summary: 'Rebuilding the index' },
    ])
    expect(rows[0]?.activity).toEqual({ kind: 'summary', text: 'Rebuilding the index' })
  })
})

describe('runningSessionFilesByPath', () => {
  it('keys running sessions by their log path, flagging the ones mid-turn', () => {
    const running = runningSessionFilesByPath([
      session({ id: 'a', sessionFile: '/sessions/a.jsonl', activity: 'idle' }),
      session({ id: 'b', sessionFile: '/sessions/b.jsonl', activity: 'working' }),
    ])

    expect(running.get('/sessions/a.jsonl')).toBe(false)
    expect(running.get('/sessions/b.jsonl')).toBe(true)
  })

  /**
   * The sidebar shows every session, not a capped popover. If this reused
   * `toRunningSessionRows` the sixth running session would silently read as
   * dead — wrong in a way the user cannot see.
   */
  it('caps nothing, unlike the popover roster', () => {
    const many = Array.from({ length: 9 }, (_, index) =>
      session({ id: `s${index}`, sessionFile: `/sessions/${index}.jsonl` }),
    )

    expect(runningSessionFilesByPath(many).size).toBe(9)
  })

  /**
   * A subagent that is turning is a live session. If its log is in the list,
   * showing it as dead would be a lie.
   */
  it('counts subagents, which the popover roster deliberately hides', () => {
    const running = runningSessionFilesByPath([
      session({
        id: 'child',
        sessionFile: '/sessions/child.jsonl',
        runtimeKind: 'subagent',
        rlmDepth: 1,
        activity: 'working',
      }),
    ])

    expect(running.get('/sessions/child.jsonl')).toBe(true)
  })

  /**
   * The daemon does not always report a `sessionFile`. Deriving one from the
   * id would be a guess, and a wrong guess lights up somebody else's row.
   */
  it('skips a session the daemon gave no log path for', () => {
    const running = runningSessionFilesByPath([
      session({ id: 'a', sessionFile: undefined }),
      session({ id: 'b', sessionFile: '   ' }),
    ])

    expect(running.size).toBe(0)
  })

  it('reports nothing rather than throwing when the roster is absent', () => {
    expect(runningSessionFilesByPath(null).size).toBe(0)
    expect(runningSessionFilesByPath(undefined).size).toBe(0)
  })

  /**
   * "Alive" here is wider than the menu bar's "is it doing work". A resident
   * session sitting idle can be reattached and can still fire a goal, so
   * calling it dead would be wrong — but it is not working either, and the
   * dot has a state for exactly that now.
   */
  it('counts an idle resident session as alive, not as finished', () => {
    const running = runningSessionFilesByPath([
      session({
        id: 'idle',
        sessionFile: '/sessions/idle.jsonl',
        activity: 'idle',
        isSessionActive: false,
        hasActiveHeartbeat: false,
      }),
    ])

    expect(running.get('/sessions/idle.jsonl')).toBe(false)
    expect(isRosterSessionRunning({ activeSessionId: 'idle', activity: 'idle' })).toBe(
      false,
    )
  })

  /** No handle means the daemon is not holding it; a log path alone is not enough. */
  it('skips a roster entry with no session handle', () => {
    const running = runningSessionFilesByPath([
      { sessionFile: '/sessions/orphan.jsonl' } as PrimeRosterSession,
    ])

    expect(running.size).toBe(0)
  })

  /** Two roster entries can share a log; "something here is turning" wins. */
  it('keeps a path working when any entry on it is working', () => {
    const running = runningSessionFilesByPath([
      session({ id: 'a', sessionFile: '/sessions/a.jsonl', activity: 'idle' }),
      session({ id: 'b', sessionFile: '/sessions/a.jsonl', activity: 'working' }),
    ])

    expect(running.get('/sessions/a.jsonl')).toBe(true)
  })
})
