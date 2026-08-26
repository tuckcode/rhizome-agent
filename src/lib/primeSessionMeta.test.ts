import { describe, expect, it } from 'vitest'
import {
  primeSessionAge,
  primeSessionMatchesQuery,
  primeSessionMetaLabel,
  primeSessionPlace,
  primeSessionRowTitles,
  primeSessionStatus,
  sortPrimeSessions,
  type PrimeSessionSummary,
} from './primeSessionMeta'

/** Local, not UTC — the labels are on the viewer's calendar day. */
const NOW = new Date(2026, 7, 13, 15, 0, 0).getTime()
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

function session(overrides: Partial<PrimeSessionSummary> = {}): PrimeSessionSummary {
  return { id: 'id-1', path: '/sessions/id-1.jsonl', ...overrides }
}

describe('primeSessionMetaLabel', () => {
  it('reads as Frame F: today carries a clock time, older days carry a name', () => {
    expect(primeSessionMetaLabel(session({ mtimeMs: new Date(2026, 7, 13, 14, 8).getTime() }), NOW))
      .toBe('Today · 14:08')
    expect(primeSessionMetaLabel(session({ mtimeMs: NOW - DAY - HOUR }), NOW)).toBe('Yesterday')
    // 2026-08-10 is a Monday.
    expect(primeSessionMetaLabel(session({ mtimeMs: new Date(2026, 7, 10, 9, 0).getTime() }), NOW))
      .toBe('Mon')
    expect(primeSessionMetaLabel(session({ mtimeMs: new Date(2026, 7, 3, 9, 0).getTime() }), NOW))
      .toBe('Aug 3')
  })

  it('pads the clock so rows line up', () => {
    expect(primeSessionMetaLabel(session({ mtimeMs: new Date(2026, 7, 13, 9, 5).getTime() }), NOW))
      .toBe('Today · 09:05')
  })

  /** What a session is doing now matters more than when it last changed. */
  it('says what a working session is doing instead of when it changed', () => {
    const label = primeSessionMetaLabel(session({ mtimeMs: NOW - HOUR }), NOW, { working: true })

    expect(label).toBe('Working · tools')
  })

  it('has no meta for a session with no timestamp', () => {
    expect(primeSessionMetaLabel(session(), NOW)).toBeNull()
  })
})

describe('primeSessionAge', () => {
  // "Yesterday" is a calendar word: 23:30 and 00:30 are an hour apart and must
  // still read differently, or the label lies to anyone working late.
  it('divides today from yesterday on the calendar day, not a rolling 24 hours', () => {
    const justAfterMidnight = new Date(2026, 7, 13, 0, 30, 0).getTime()
    const justBeforeMidnight = new Date(2026, 7, 12, 23, 30, 0).getTime()
    const now = justAfterMidnight + HOUR

    expect(primeSessionAge(session({ mtimeMs: justAfterMidnight }), now)).toBe('today')
    expect(primeSessionAge(session({ mtimeMs: justBeforeMidnight }), now)).toBe('yesterday')
  })

  it('buckets the rest by week and older', () => {
    expect(primeSessionAge(session({ mtimeMs: NOW - 3 * DAY }), NOW)).toBe('week')
    expect(primeSessionAge(session({ mtimeMs: NOW - 30 * DAY }), NOW)).toBe('older')
    expect(primeSessionAge(session(), NOW)).toBe('undated')
  })
})

describe('sortPrimeSessions', () => {
  it('puts the newest first', () => {
    const sorted = sortPrimeSessions([
      session({ id: 'older', mtimeMs: NOW - 5 * HOUR }),
      session({ id: 'newer', mtimeMs: NOW - HOUR }),
      session({ id: 'middle', mtimeMs: NOW - 3 * HOUR }),
    ])

    expect(sorted.map((s) => s.id)).toEqual(['newer', 'middle', 'older'])
  })

  /** A filesystem quirk must not hide a real conversation — sink, not drop. */
  it('sinks undated sessions to the bottom without dropping them', () => {
    const sorted = sortPrimeSessions([
      session({ id: 'undated' }),
      session({ id: 'dated', mtimeMs: NOW - HOUR }),
    ])

    expect(sorted.map((s) => s.id)).toEqual(['dated', 'undated'])
  })

  it('does not mutate the input', () => {
    const input = [session({ id: 'a', mtimeMs: 1 }), session({ id: 'b', mtimeMs: 2 })]
    sortPrimeSessions(input)

    expect(input.map((s) => s.id)).toEqual(['a', 'b'])
  })
})

describe('primeSessionRowTitles', () => {
  const UNTITLED = 'Untitled'

  it('uses the session title when it has one', () => {
    const titles = primeSessionRowTitles(
      [session({ id: 'a', title: 'Inbox triage' }), session({ id: 'b', title: 'Release notes' })],
      UNTITLED,
    )

    expect(titles).toEqual(['Inbox triage', 'Release notes'])
  })

  it('falls back for a session with no title, and for a blank one', () => {
    const titles = primeSessionRowTitles(
      [session({ id: 'a' }), session({ id: 'b', title: '   ' })],
      UNTITLED,
    )

    expect(titles).toEqual(['Untitled · a', 'Untitled · b'])
  })

  it('trims a title rather than rendering its whitespace', () => {
    expect(primeSessionRowTitles([session({ title: '  Inbox triage  ' })], UNTITLED))
      .toEqual(['Inbox triage'])
  })

  /**
   * The defect #28 named and #30 carried: two untitled rows stacked on top of
   * each other, impossible to tell apart. A session with messages but no
   * *user* message has no title, so this survives the empty-session filter.
   */
  it('never renders two identical rows', () => {
    const titles = primeSessionRowTitles(
      [
        session({ id: '01a0252e-b9d5-71e9-83de-2bce32f65c06' }),
        session({ id: '01a0252e-b6b9-749a-ad79-4c8c33e521f9' }),
      ],
      UNTITLED,
    )

    expect(new Set(titles).size).toBe(2)
  })

  /**
   * Session ids are uuidv7: the leading characters are a timestamp, so two
   * sessions created milliseconds apart share them. Measured on 93 real logs,
   * the first six characters gave 23 distinct values. Suffixing with the
   * prefix would have rendered "Untitled · 01a025" twice — the bug, restated.
   */
  it('disambiguates on the part of a uuidv7 that varies, not the clock prefix', () => {
    const titles = primeSessionRowTitles(
      [
        session({ id: '01a0252e-b9d5-71e9-83de-2bce32f65c06' }),
        session({ id: '01a0252e-b6b9-749a-ad79-4c8c33e521f9' }),
      ],
      UNTITLED,
    )

    expect(titles).toEqual(['Untitled · f65c06', 'Untitled · e521f9'])
  })

  it('leaves a unique title unsuffixed even when a neighbour collides', () => {
    const titles = primeSessionRowTitles(
      [
        session({ id: 'aaaaaa', title: 'Release notes' }),
        session({ id: 'bbbbbb' }),
        session({ id: 'cccccc' }),
      ],
      UNTITLED,
    )

    expect(titles[0]).toBe('Release notes')
    expect(titles[1]).not.toBe(titles[2])
  })

  it('returns a title per session, in order, for an empty list too', () => {
    expect(primeSessionRowTitles([], UNTITLED)).toEqual([])
  })

  /**
   * #33. The first version suffixed any repeated *title*, which put hex on
   * rows a user could already tell apart:
   *
   *     Untitled session · e521f9        Untitled session · 904ab3
   *     Today · 07:29 · rhizome-agent    Yesterday · tmp
   *
   * The meta lines differ completely. Suffixing there solved a collision the
   * second line had already resolved, on the line the eye reads first.
   */
  it('leaves an untitled title alone when the rest of the row already differs', () => {
    const titles = primeSessionRowTitles(
      [session({ id: 'aaaaaa111111' }), session({ id: 'bbbbbb222222' })],
      UNTITLED,
      ['Today · 07:29 · rhizome-agent', 'Yesterday · tmp'],
    )

    expect(titles).toEqual(['Untitled', 'Untitled'])
  })

  /** And still suffixes when the whole row would genuinely repeat. */
  it('suffixes when the meta matches too, because then the rows are identical', () => {
    const titles = primeSessionRowTitles(
      [session({ id: 'aaaaaa111111' }), session({ id: 'bbbbbb222222' })],
      UNTITLED,
      ['Today · 07:29', 'Today · 07:29'],
    )

    expect(titles).toEqual(['Untitled · 111111', 'Untitled · 222222'])
  })

  it('treats a missing meta as no meta rather than as a distinguishing one', () => {
    const titles = primeSessionRowTitles(
      [session({ id: 'aaaaaa111111' }), session({ id: 'bbbbbb222222' })],
      UNTITLED,
      [null, null],
    )

    expect(titles).toEqual(['Untitled · 111111', 'Untitled · 222222'])
  })
})

describe('primeSessionPlace', () => {
  const VAULT = '/Users/dtc/Documents/Rhizome Vault'
  const HOME = '/Users/dtc'

  /**
   * The list shows every log in `~/.prime/agent/sessions` regardless of which
   * client wrote it, and #28 called the result unexplained clutter. Measured
   * on 93 real logs: 16 distinct working directories, and 28 of the 93 ran in
   * a temp directory — test runs, not the user's work.
   *
   * Naming *which app* wrote a session is not possible: the `session` header
   * line carries `cwd`, `timestamp`, `git` and sometimes `parentSession`, and
   * no client field at all. Where it ran is the honest answer.
   */
  it('names the directory a session ran in', () => {
    expect(primeSessionPlace(session({ cwd: '/Users/dtc/code/projects/rhizome-agent' }), VAULT))
      .toBe('rhizome-agent')
    expect(primeSessionPlace(session({ cwd: '/private/tmp' }), VAULT)).toBe('tmp')
  })

  /**
   * Saying "Rhizome Vault" on every row of a list you opened from inside the
   * Rhizome Vault is noise on the common case to serve the rare one. The row
   * earns its place label by being from somewhere *else*.
   */
  it('says nothing when the session ran in the vault that is open', () => {
    expect(primeSessionPlace(session({ cwd: VAULT }), VAULT)).toBeNull()
    expect(primeSessionPlace(session({ cwd: `${VAULT}/` }), VAULT)).toBeNull()
  })

  it('writes the home directory as ~ rather than a username', () => {
    expect(primeSessionPlace(session({ cwd: HOME }), VAULT)).toBe('~')
  })

  it('has nothing to say about a session with no recorded directory', () => {
    expect(primeSessionPlace(session(), VAULT)).toBeNull()
    expect(primeSessionPlace(session({ cwd: '   ' }), VAULT)).toBeNull()
  })

  /**
   * With no vault open — the list can render before one is chosen — every
   * session is from somewhere else, so every one says where.
   */
  it('names every place when there is no vault to compare against', () => {
    expect(primeSessionPlace(session({ cwd: VAULT }), null)).toBe('Rhizome Vault')
  })

  it('falls back to the whole path when there is no basename to take', () => {
    expect(primeSessionPlace(session({ cwd: '/' }), VAULT)).toBe('/')
  })
})

describe('primeSessionMetaLabel with a place', () => {
  const VAULT = '/Users/dtc/Documents/Rhizome Vault'
  const at = (h: number, m: number) => new Date(2026, 7, 13, h, m).getTime()

  it('appends the place after the time, so the sort key stays leftmost', () => {
    const label = primeSessionMetaLabel(
      session({ mtimeMs: at(14, 8), cwd: '/Users/dtc/code/projects/rhizome-agent' }),
      NOW,
      { vaultPath: VAULT },
    )

    expect(label).toBe('Today · 14:08 · rhizome-agent')
  })

  it('leaves the label exactly as it was for a session from the open vault', () => {
    const label = primeSessionMetaLabel(session({ mtimeMs: at(14, 8), cwd: VAULT }), NOW, {
      vaultPath: VAULT,
    })

    expect(label).toBe('Today · 14:08')
  })

  it('carries the place on older rows too', () => {
    expect(
      primeSessionMetaLabel(session({ mtimeMs: NOW - DAY - HOUR, cwd: '/private/tmp' }), NOW, {
        vaultPath: VAULT,
      }),
    ).toBe('Yesterday · tmp')
  })

  /**
   * What it is doing now matters more than where it did it — the working row
   * is the one the user is watching, and it is the session that is open.
   */
  it('says nothing about place while a session is working', () => {
    expect(
      primeSessionMetaLabel(session({ mtimeMs: at(14, 8), cwd: '/private/tmp' }), NOW, {
        working: true,
        vaultPath: VAULT,
      }),
    ).toBe('Working · tools')
  })

  /**
   * A session with no timestamp had no meta line at all. Where it ran is still
   * worth saying — an unplaceable row with a place beats an empty one.
   */
  it('shows the place alone when there is no timestamp', () => {
    expect(
      primeSessionMetaLabel(session({ cwd: '/private/tmp' }), NOW, {
        vaultPath: VAULT,
      }),
    ).toBe('tmp')
  })

  it('is unchanged when no vault or home is supplied at all', () => {
    expect(primeSessionMetaLabel(session({ mtimeMs: at(14, 8) }), NOW)).toBe('Today · 14:08')
  })
})

describe('primeSessionStatus', () => {
  const at = (path: string) => session({ path })

  it('is saved when the daemon has never heard of the log', () => {
    expect(primeSessionStatus(at('/sessions/a.jsonl'), new Map())).toBe('saved')
  })

  /**
   * The state that did not exist before: alive, but not turning. A session
   * outlives the window (ADR-0163), so "I left this running" is a different
   * answer from "this is finished", and the list used to give both the same
   * dot.
   */
  it('is running when the daemon has it but nothing is turning', () => {
    const running = new Map([['/sessions/a.jsonl', false]])

    expect(primeSessionStatus(at('/sessions/a.jsonl'), running)).toBe('running')
  })

  it('is working when the daemon says that session is mid-turn', () => {
    const running = new Map([['/sessions/a.jsonl', true]])

    expect(primeSessionStatus(at('/sessions/a.jsonl'), running)).toBe('working')
  })

  it('does not light up a neighbour that merely sorts next to a running one', () => {
    const running = new Map([['/sessions/a.jsonl', true]])

    expect(primeSessionStatus(at('/sessions/b.jsonl'), running)).toBe('saved')
  })
})

describe('primeSessionMatchesQuery', () => {
  it('keeps every row when the query is blank', () => {
    expect(primeSessionMatchesQuery(session({ title: 'Vault watcher' }), '   ')).toBe(true)
  })

  it('matches the title the user can see, not only the stored name', () => {
    const untitled = session({ title: null })
    expect(primeSessionMatchesQuery(untitled, 'f65c06', 'Untitled session · f65c06')).toBe(true)
    expect(primeSessionMatchesQuery(untitled, 'vault', 'Untitled session · f65c06')).toBe(false)
  })

  it('matches place and branch so a search for where it ran still hits', () => {
    const row = session({
      title: 'Watch the inbox',
      cwd: '/Users/dtc/code/projects/rhizome-agent',
      gitBranch: 'shell-harden',
    })

    expect(primeSessionMatchesQuery(row, 'rhizome-agent')).toBe(true)
    expect(primeSessionMatchesQuery(row, 'shell-harden')).toBe(true)
    expect(primeSessionMatchesQuery(row, 'desktop')).toBe(false)
  })
})
