import { parseDashDateParts, parseSlashDateParts, type DateParts } from './dateStringParts'

export type DateDisplayFormat = 'us' | 'european' | 'friendly' | 'iso'

export const DEFAULT_DATE_DISPLAY_FORMAT: DateDisplayFormat = 'friendly'
export const DATE_DISPLAY_FORMATS: readonly DateDisplayFormat[] = ['us', 'european', 'friendly', 'iso']

/** Stored as `null`. The picker uses this sentinel because Select cannot use an empty value. */
export const LOCAL_DISPLAY_TIME_ZONE = 'local'

let activeDisplayTimeZone: string | null = null
let cachedTimeZones: readonly string[] | null = null

export function listDisplayTimeZones(): readonly string[] {
  if (cachedTimeZones) return cachedTimeZones
  if (typeof Intl.supportedValuesOf !== 'function') {
    cachedTimeZones = []
    return cachedTimeZones
  }
  cachedTimeZones = Intl.supportedValuesOf('timeZone')
  return cachedTimeZones
}

export function normalizeDisplayTimeZone(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const lower = trimmed.toLowerCase()
  if (lower === 'local' || lower === 'none') return null
  if (isNumericUtcOffset(trimmed)) return null
  const zones = listDisplayTimeZones()
  if (zones.length === 0) return isIanaTimeZoneName(trimmed) ? trimmed : null
  return zones.find((zone) => zone.toLowerCase() === lower) ?? null
}

export function bindDisplayTimeZone(timeZone: string | null): void {
  activeDisplayTimeZone = normalizeDisplayTimeZone(timeZone)
}

function chosenZone(timeZone: string | null | undefined): string | null {
  if (timeZone === undefined) return activeDisplayTimeZone
  return normalizeDisplayTimeZone(timeZone)
}

function isNumericUtcOffset(value: string): boolean {
  return /^(?:UTC|GMT)?[+-]\d{1,2}(?::?\d{2})?$/i.test(value)
}

function isIanaTimeZoneName(value: string): boolean {
  if (value.length < 2 || value.length > 64) return false
  if (!/^[A-Za-z0-9_/+-]+$/.test(value)) return false
  if (value.includes('/')) {
    const parts = value.split('/')
    return parts.length >= 2 && parts.every((part) => part.length > 0)
  }
  return /^[A-Za-z]+$/.test(value)
}

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

interface ClockParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

function localClockParts(date: Date): ClockParts {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
  }
}

function zonedClockParts(date: Date, timeZone: string): ClockParts | null {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
    const bag = new Map(formatter.formatToParts(date).map((part) => [part.type, part.value]))
    const year = Number(bag.get('year'))
    const month = Number(bag.get('month'))
    const day = Number(bag.get('day'))
    let hour = Number(bag.get('hour'))
    const minute = Number(bag.get('minute'))
    if (![year, month, day, hour, minute].every(Number.isFinite)) return null
    if (hour === 24) hour = 0
    return { year, month, day, hour, minute }
  } catch {
    return null
  }
}

function clockParts(date: Date, timeZone: string | null | undefined): ClockParts {
  const zone = chosenZone(timeZone)
  if (!zone) return localClockParts(date)
  return zonedClockParts(date, zone) ?? localClockParts(date)
}

function datePartsFromDate(date: Date, timeZone?: string | null): DateParts {
  const parts = clockParts(date, timeZone)
  return { year: parts.year, month: parts.month, day: parts.day }
}

export function formatDateForDisplay(
  date: Date,
  format: DateDisplayFormat = DEFAULT_DATE_DISPLAY_FORMAT,
  timeZone?: string | null,
): string {
  return formatDatePartsForDisplay(datePartsFromDate(date, timeZone), format)
}

export function formatTimestampForDateDisplay(
  timestampSeconds: number | null | undefined,
  format: DateDisplayFormat = DEFAULT_DATE_DISPLAY_FORMAT,
  timeZone?: string | null,
): string {
  if (!timestampSeconds) return ''
  return formatDateForDisplay(new Date(timestampSeconds * 1000), format, timeZone)
}

/** Clock time, `14:08`. `None` uses this machine. A zone uses `Intl` in that zone. */
export function formatTimeForDisplay(date: Date, timeZone?: string | null): string {
  const parts = clockParts(date, timeZone)
  return `${twoDigit(parts.hour)}:${twoDigit(parts.minute)}`
}

export function clockPartsForDisplay(
  date: Date,
  timeZone?: string | null,
): { hour: number; minute: number } {
  const parts = clockParts(date, timeZone)
  return { hour: parts.hour, minute: parts.minute }
}

/** Same calendar day in the display zone, or on this machine when the zone is `None`. */
export function isSameDisplayDay(a: Date, b: Date, timeZone?: string | null): boolean {
  const left = datePartsFromDate(a, timeZone)
  const right = datePartsFromDate(b, timeZone)
  return left.year === right.year && left.month === right.month && left.day === right.day
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
 * `None` follows this machine. A chosen IANA zone formats through `Intl` and
 * does not read `getHours` or `getDate`.
 */
export function formatSavedLabel(
  savedSeconds: number | null | undefined,
  createdSeconds: number | null | undefined,
  format: DateDisplayFormat = DEFAULT_DATE_DISPLAY_FORMAT,
  timeZone?: string | null,
): string {
  if (!savedSeconds) return ''
  const saved = new Date(savedSeconds * 1000)
  if (!createdSeconds) return formatDateForDisplay(saved, format, timeZone)

  const created = new Date(createdSeconds * 1000)
  return isSameDisplayDay(saved, created, timeZone)
    ? formatTimeForDisplay(saved, timeZone)
    : formatDateForDisplay(saved, format, timeZone)
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
