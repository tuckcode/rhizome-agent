import { describe, expect, it } from 'vitest'
import {
  primeSessionAge,
  primeSessionMetaLabel,
  primeSessionRowTitles,
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
})
