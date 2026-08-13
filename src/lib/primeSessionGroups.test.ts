import { describe, expect, it } from 'vitest'
import {
  groupPrimeSessions,
  relativeSessionTime,
  type PrimeSessionSummary,
} from './primeSessionGroups'

/** 2026-08-13T15:00:00Z — every case is relative to this fixed "now". */
const NOW = Date.UTC(2026, 7, 13, 15, 0, 0)
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

function session(overrides: Partial<PrimeSessionSummary> = {}): PrimeSessionSummary {
  return {
    id: 'id-1',
    path: '/sessions/id-1.jsonl',
    title: 'a session',
    ...overrides,
  }
}

describe('groupPrimeSessions', () => {
  it('splits sessions into today, yesterday, this week and earlier', () => {
    const groups = groupPrimeSessions(
      [
        session({ id: 'now', mtimeMs: NOW - HOUR }),
        session({ id: 'yesterday', mtimeMs: NOW - DAY - HOUR }),
        session({ id: 'week', mtimeMs: NOW - 4 * DAY }),
        session({ id: 'old', mtimeMs: NOW - 90 * DAY }),
      ],
      NOW,
    )

    expect(groups.map((group) => group.key)).toEqual(['today', 'yesterday', 'week', 'earlier'])
    expect(groups.map((group) => group.sessions.map((s) => s.id))).toEqual([
      ['now'],
      ['yesterday'],
      ['week'],
      ['old'],
    ])
  })

  it('omits groups that have no sessions rather than rendering empty headings', () => {
    const groups = groupPrimeSessions([session({ mtimeMs: NOW - HOUR })], NOW)

    expect(groups).toHaveLength(1)
    expect(groups[0].key).toBe('today')
  })

  it('orders sessions newest first inside a group', () => {
    const groups = groupPrimeSessions(
      [
        session({ id: 'older', mtimeMs: NOW - 5 * HOUR }),
        session({ id: 'newer', mtimeMs: NOW - 1 * HOUR }),
        session({ id: 'middle', mtimeMs: NOW - 3 * HOUR }),
      ],
      NOW,
    )

    expect(groups[0].sessions.map((s) => s.id)).toEqual(['newer', 'middle', 'older'])
  })

  // "Yesterday" is a calendar word. 23:30 and 00:30 are an hour apart and must
  // still land in different groups, or the heading lies to anyone working late.
  // Local, not UTC: the grouping is on the viewer's calendar day, so a test
  // written in UTC would pass or fail depending on the machine's timezone.
  it('divides today from yesterday on the calendar day, not a rolling 24 hours', () => {
    const justAfterMidnight = new Date(2026, 7, 13, 0, 30, 0).getTime()
    const justBeforeMidnight = new Date(2026, 7, 12, 23, 30, 0).getTime()

    const groups = groupPrimeSessions(
      [
        session({ id: 'after', mtimeMs: justAfterMidnight }),
        session({ id: 'before', mtimeMs: justBeforeMidnight }),
      ],
      justAfterMidnight + HOUR,
    )

    expect(groups.find((group) => group.key === 'today')?.sessions.map((s) => s.id)).toEqual([
      'after',
    ])
    expect(groups.find((group) => group.key === 'yesterday')?.sessions.map((s) => s.id)).toEqual([
      'before',
    ])
  })

  // A log whose mtime could not be read still has to be reachable. Dropping it
  // would hide a real conversation because of a filesystem quirk.
  it('keeps sessions with no timestamp, in a group of their own at the end', () => {
    const groups = groupPrimeSessions(
      [session({ id: 'dated', mtimeMs: NOW - HOUR }), session({ id: 'undated' })],
      NOW,
    )

    expect(groups.map((group) => group.key)).toEqual(['today', 'undated'])
    expect(groups[1].sessions.map((s) => s.id)).toEqual(['undated'])
  })

  it('returns nothing for an empty list', () => {
    expect(groupPrimeSessions([], NOW)).toEqual([])
  })
})

describe('relativeSessionTime', () => {
  const at = (ms: number) => ({ id: 'x', path: '/x.jsonl', mtimeMs: NOW - ms })

  it('reads coarser as a session gets older', () => {
    expect(relativeSessionTime(at(30 * 1000), NOW)).toBe('now')
    expect(relativeSessionTime(at(5 * 60 * 1000), NOW)).toBe('5m ago')
    expect(relativeSessionTime(at(3 * HOUR), NOW)).toBe('3h ago')
    expect(relativeSessionTime(at(DAY), NOW)).toBe('yesterday')
    expect(relativeSessionTime(at(3 * DAY), NOW)).toBe('3d ago')
    expect(relativeSessionTime(at(14 * DAY), NOW)).toBe('2w ago')
    expect(relativeSessionTime(at(90 * DAY), NOW)).toBe('3mo ago')
  })

  // Clock skew makes a file look newer than "now". "in 3 minutes" on a list of
  // past conversations reads as a bug, so the future clamps to the present.
  it('clamps a future timestamp to now rather than counting forward', () => {
    expect(relativeSessionTime(at(-5 * 60 * 1000), NOW)).toBe('now')
  })

  it('has no label for a session with no timestamp', () => {
    expect(relativeSessionTime({ id: 'x', path: '/x.jsonl' }, NOW)).toBeNull()
  })
})
