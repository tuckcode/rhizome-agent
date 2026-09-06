/**
 * Clock labels on Chat bubbles (C70).
 *
 * Matches new-session naming style (`3:35p`) so the transcript and the
 * sessions list speak the same time language.
 */

export function normalizeMessageTimestampMs(value: number | undefined | null): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  // Unix seconds vs milliseconds: anything before ~Sep 2001 in ms-space is
  // almost certainly seconds when it came from a log.
  return value < 1e12 ? Math.trunc(value * 1000) : Math.trunc(value)
}

/** Local clock like `3:35p` / `12:05a`. Empty string when unusable. */
export function formatMessageClock(ms: number): string {
  const normalized = normalizeMessageTimestampMs(ms)
  if (normalized === undefined) return ''
  const date = new Date(normalized)
  let hours = date.getHours()
  const minutes = date.getMinutes()
  const meridiem = hours >= 12 ? 'p' : 'a'
  hours = hours % 12
  if (hours === 0) hours = 12
  return `${hours}:${String(minutes).padStart(2, '0')}${meridiem}`
}
