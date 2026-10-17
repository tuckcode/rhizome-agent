import { disambiguateTitles } from './disambiguateTitles'

const HISTORY_OPEN = ['<', 'conversation_history', '>'].join('')
const HISTORY_CLOSE = ['</', 'conversation_history', '>'].join('')
const MAX_LABEL_CHARS = 80
export const MYCELIUM_UNTITLED_SESSION = 'Untitled session'

export interface MyceliumTitleSource {
  id: string
  title?: string | null
}

/**
 * Mycelium row title. A stored title is used as written. A
 * `<conversation_history>` blob is not a title: the first user turn is.
 * Anything empty becomes "Untitled session".
 */
export function myceliumSessionTitle(
  raw: string | null | undefined,
  fallback = MYCELIUM_UNTITLED_SESSION,
): string {
  const text = (raw ?? '').trim()
  if (!text) return fallback
  const source = text.includes(HISTORY_OPEN) ? firstUserTurn(text) : text
  return clip(source, fallback)
}

export function myceliumSessionTitles(sessions: readonly MyceliumTitleSource[]): string[] {
  const rows = sessions.map((session) => ({
    id: session.id,
    title: myceliumSessionTitle(session.title),
  }))
  return disambiguateTitles(rows, (row) => row.id.slice(-6)).map((row) => row.title)
}

function clip(raw: string, fallback: string): string {
  const collapsed = raw.replace(/\s+/g, ' ').trim()
  if (!collapsed) return fallback
  if (collapsed.length <= MAX_LABEL_CHARS) return collapsed
  return `${collapsed.slice(0, MAX_LABEL_CHARS).trimEnd()}…`
}

function firstUserTurn(raw: string): string {
  const start = raw.indexOf(HISTORY_OPEN)
  const innerStart = start < 0 ? 0 : start + HISTORY_OPEN.length
  const end = raw.indexOf(HISTORY_CLOSE, innerStart)
  const inner = (end < 0 ? raw.slice(innerStart) : raw.slice(innerStart, end)).trim()
  const parts = inner.split(/\[user]:\s*/i).slice(1)
  const first = parts[0]?.split(/\[assistant]:/i)[0] ?? ''
  return first
}
