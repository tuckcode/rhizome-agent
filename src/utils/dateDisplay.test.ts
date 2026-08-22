import { describe, expect, it } from 'vitest'
import {
  formatDatePartsForDisplay,
  formatDateValueForDisplay,
  normalizeDateDisplayFormat,
  formatSavedLabel,
} from './dateDisplay'

describe('dateDisplay', () => {
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
