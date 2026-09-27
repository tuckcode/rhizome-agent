import { beforeEach, describe, expect, it } from 'vitest'
import {
  bindDisplayTimeZone,
  formatDatePartsForDisplay,
  formatDateValueForDisplay,
  formatSavedLabel,
  formatTimeForDisplay,
  formatTimestampForDateDisplay,
  normalizeDateDisplayFormat,
  normalizeDisplayTimeZone,
} from './dateDisplay'

/** 2026-01-16 04:30 UTC. Chicago is still Jan 15; Rome is already Jan 16. */
const CROSS_ZONE_INSTANT_MS = Date.parse('2026-01-16T04:30:00.000Z')
const CROSS_ZONE_SECONDS = CROSS_ZONE_INSTANT_MS / 1000

describe('dateDisplay', () => {
  beforeEach(() => {
    bindDisplayTimeZone(null)
  })

  it('normalizes supported date display formats', () => {
    expect(normalizeDateDisplayFormat(' ISO ')).toBe('iso')
    expect(normalizeDateDisplayFormat('friendly')).toBe('friendly')
    expect(normalizeDateDisplayFormat('long')).toBeNull()
    expect(normalizeDateDisplayFormat(null)).toBeNull()
  })

  it('formats date parts in every supported display style', () => {
    const parts = { year: 2026, month: 5, day: 11 }

    expect(formatDatePartsForDisplay(parts, 'us')).toBe('5/11/2026')
    expect(formatDatePartsForDisplay(parts, 'european')).toBe('11/5/2026')
    expect(formatDatePartsForDisplay(parts, 'friendly')).toBe('May 11, 2026')
    expect(formatDatePartsForDisplay(parts, 'iso')).toBe('2026-05-11')
  })

  it('formats ISO and slash date values without changing non-dates', () => {
    expect(formatDateValueForDisplay('2026-05-11', 'european')).toBe('11/5/2026')
    expect(formatDateValueForDisplay('05/11/2026', 'friendly')).toBe('May 11, 2026')
    expect(formatDateValueForDisplay('next Monday', 'iso')).toBe('next Monday')
  })

  it('shows one instant as Chicago and as Rome', () => {
    const instant = new Date(CROSS_ZONE_INSTANT_MS)

    expect(formatTimestampForDateDisplay(CROSS_ZONE_SECONDS, 'iso', 'America/Chicago')).toBe('2026-01-15')
    expect(formatTimestampForDateDisplay(CROSS_ZONE_SECONDS, 'iso', 'Europe/Rome')).toBe('2026-01-16')
    expect(formatTimeForDisplay(instant, 'America/Chicago')).toBe('22:30')
    expect(formatTimeForDisplay(instant, 'Europe/Rome')).toBe('05:30')
    expect(formatSavedLabel(CROSS_ZONE_SECONDS, Date.parse('2026-01-15T15:00:00.000Z') / 1000, 'friendly', 'America/Chicago')).toBe('22:30')
    expect(formatSavedLabel(CROSS_ZONE_SECONDS, Date.parse('2026-01-15T15:00:00.000Z') / 1000, 'friendly', 'Europe/Rome')).toBe('January 16, 2026')
  })

  it('round-trips an IANA name and drops offsets', () => {
    const stored = JSON.parse(JSON.stringify({
      timezone: normalizeDisplayTimeZone(' America/Chicago '),
    })) as { timezone: string | null }

    expect(stored.timezone).toBe('America/Chicago')
    expect(normalizeDisplayTimeZone(stored.timezone)).toBe('America/Chicago')
    expect(normalizeDisplayTimeZone('Europe/Rome')).toBe('Europe/Rome')
    expect(normalizeDisplayTimeZone('+05:00')).toBeNull()
    expect(normalizeDisplayTimeZone('UTC-6')).toBeNull()
    expect(normalizeDisplayTimeZone('UTC+05:00')).toBeNull()
    expect(normalizeDisplayTimeZone('local')).toBeNull()
    expect(normalizeDisplayTimeZone(null)).toBeNull()
    expect(normalizeDisplayTimeZone('')).toBeNull()
  })

  it('None matches local behavior', () => {
    const date = new Date(2026, 0, 16, 4, 30, 0)
    const seconds = date.getTime() / 1000
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ]
    const localDate = `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
    const localClock = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`

    expect(formatTimestampForDateDisplay(seconds, 'friendly', null)).toBe(localDate)
    expect(formatTimestampForDateDisplay(seconds, 'friendly')).toBe(localDate)
    expect(formatTimeForDisplay(date, null)).toBe(localClock)
    expect(formatTimeForDisplay(date)).toBe(localClock)
    expect(formatSavedLabel(seconds, seconds, 'friendly', null)).toBe(localClock)
    expect(formatSavedLabel(seconds, seconds, 'friendly')).toBe(localClock)
  })
})

describe('formatSavedLabel', () => {
  const secs = (iso: string) => new Date(iso).getTime() / 1000

  /**
   * A note row prints "saved" beside "created". While both fall on the same
   * day — most of a note's life, and all of a freshly imported vault — the row
   * printed one date twice. The right half already says the date.
   */
  it('shows the clock time when the note was saved the day it was created', () => {
    const label = formatSavedLabel(secs('2026-08-22T14:08:00'), secs('2026-08-22T09:00:00'))

    expect(label).toBe('14:08')
  })

  it('shows the date when they are different days, because then it is not redundant', () => {
    const label = formatSavedLabel(secs('2026-08-22T14:08:00'), secs('2026-06-23T09:00:00'))

    expect(label).toBe('August 22, 2026')
  })

  it('shows the date when there is no created timestamp to be redundant with', () => {
    expect(formatSavedLabel(secs('2026-08-22T14:08:00'), null)).toBe('August 22, 2026')
  })

  it('says nothing when there is no saved timestamp', () => {
    expect(formatSavedLabel(null, secs('2026-08-22T09:00:00'))).toBe('')
  })

  it('honours the chosen date format for the non-redundant case', () => {
    expect(formatSavedLabel(secs('2026-08-22T14:08:00'), secs('2026-06-23T09:00:00'), 'iso'))
      .toBe('2026-08-22')
  })

  it('pads the clock so rows line up', () => {
    expect(formatSavedLabel(secs('2026-08-22T09:05:00'), secs('2026-08-22T08:00:00'))).toBe('09:05')
  })
})
