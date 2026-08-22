import { parseDashDateParts, parseSlashDateParts, type DateParts } from './dateStringParts'

export type DateDisplayFormat = 'us' | 'european' | 'friendly' | 'iso'

export const DEFAULT_DATE_DISPLAY_FORMAT: DateDisplayFormat = 'friendly'
export const DATE_DISPLAY_FORMATS: readonly DateDisplayFormat[] = ['us', 'european', 'friendly', 'iso']

const FRIENDLY_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

function isDateDisplayFormat(value: string): value is DateDisplayFormat {
  return DATE_DISPLAY_FORMATS.includes(value as DateDisplayFormat)
}

export function normalizeDateDisplayFormat(value: unknown): DateDisplayFormat | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  return isDateDisplayFormat(normalized) ? normalized : null
}

function twoDigit(value: number): string {
  return String(value).padStart(2, '0')
}

export function formatDatePartsForDisplay(
  parts: DateParts,
  format: DateDisplayFormat = DEFAULT_DATE_DISPLAY_FORMAT,
): string {
  if (format === 'us') return `${parts.month}/${parts.day}/${parts.year}`
  if (format === 'european') return `${parts.day}/${parts.month}/${parts.year}`
  if (format === 'iso') return `${parts.year}-${twoDigit(parts.month)}-${twoDigit(parts.day)}`
  return `${FRIENDLY_MONTHS[parts.month - 1]} ${parts.day}, ${parts.year}`
}

function datePartsFromDate(date: Date): DateParts {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  }
}

export function formatDateForDisplay(
  date: Date,
  format: DateDisplayFormat = DEFAULT_DATE_DISPLAY_FORMAT,
): string {
  return formatDatePartsForDisplay(datePartsFromDate(date), format)
}

export function formatTimestampForDateDisplay(
  timestampSeconds: number | null | undefined,
  format: DateDisplayFormat = DEFAULT_DATE_DISPLAY_FORMAT,
): string {
  if (!timestampSeconds) return ''
  return formatDateForDisplay(new Date(timestampSeconds * 1000), format)
}

/** Local clock time, `14:08`. Matches the session list's meta line. */
export function formatTimeForDisplay(date: Date): string {
  return `${twoDigit(date.getHours())}:${twoDigit(date.getMinutes())}`
}

/** Same calendar day on the viewer's own clock. */
export function isSameDisplayDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
  )
}

/**
 * What the "modified" half of a note row should say.
 *
 * A note row shows when it was saved and when it was created. Whenever both
 * fall on the same day — which is most of a note's life, and all of a freshly
 * imported vault — that spent the row printing one date twice:
 *
 *     August 22, 2026                    Created August 22, 2026
 *
 * The second half already says the date, so the first half says the clock time
 * instead. Nothing is lost and the row starts carrying information it did not
 * before.
 *
 * Local time throughout, which is what `getHours` and `getDate` read — a
 * timestamp is only meaningful to a reader in their own zone.
 */
export function formatSavedLabel(
  savedSeconds: number | null | undefined,
  createdSeconds: number | null | undefined,
  format: DateDisplayFormat = DEFAULT_DATE_DISPLAY_FORMAT,
): string {
  if (!savedSeconds) return ''
  const saved = new Date(savedSeconds * 1000)
  if (!createdSeconds) return formatDateForDisplay(saved, format)

  const created = new Date(createdSeconds * 1000)
  return isSameDisplayDay(saved, created)
    ? formatTimeForDisplay(saved)
    : formatDateForDisplay(saved, format)
}

export function parseDateDisplayParts(value: string): DateParts | null {
  return parseDashDateParts(value) ?? parseSlashDateParts(value)
}

export function formatDateValueForDisplay(
  value: string,
  format: DateDisplayFormat = DEFAULT_DATE_DISPLAY_FORMAT,
): string {
  const parts = parseDateDisplayParts(value)
  return parts ? formatDatePartsForDisplay(parts, format) : value
}
