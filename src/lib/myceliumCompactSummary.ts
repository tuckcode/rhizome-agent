/**
 * Labels and counts for the docked Mycelium card.
 *
 * Compact Connections must not dump a prompt or a city. It shows a readable
 * session name and a few facts. Prime often stores the first user turn as a
 * `<conversation_history>` blob, which is not a title.
 */

const HISTORY_OPEN = ['<', 'conversation_history', '>'].join('')
const HISTORY_CLOSE = ['</', 'conversation_history', '>'].join('')
const MAX_LABEL_CHARS = 80

export function readableSessionLabel(raw: string, fallback = 'Untitled session'): string {
  const source = unwrapConversationHistory(raw)
  const collapsed = source.replace(/\s+/g, ' ').trim()
  if (!collapsed) return fallback
  if (collapsed.length <= MAX_LABEL_CHARS) return collapsed
  return `${collapsed.slice(0, MAX_LABEL_CHARS).trimEnd()}…`
}

export function compactSessionFacts(paths: Array<string | undefined>): {
  toolCount: number
  fileCount: number
  fileNames: string[]
} {
  const toolCount = paths.length
  const unique = [...new Set(paths.filter((path): path is string => Boolean(path)))]
  return {
    toolCount,
    fileCount: unique.length,
    fileNames: unique.map((path) => path.split('/').pop() || path),
  }
}

function unwrapConversationHistory(raw: string): string {
  const text = raw.trim()
  const start = text.indexOf(HISTORY_OPEN)
  if (start < 0) return text
  const innerStart = start + HISTORY_OPEN.length
  const end = text.indexOf(HISTORY_CLOSE, innerStart)
  const inner = (end < 0 ? text.slice(innerStart) : text.slice(innerStart, end)).trim()
  const lastUser = lastUserTurn(inner)
  return lastUser || inner.replace(/\[(?:user|assistant)]:\s*/gi, '').trim()
}

function lastUserTurn(inner: string): string {
  const parts = inner.split(/\[user]:\s*/i).slice(1)
  if (!parts.length) return ''
  const last = parts.at(-1) ?? ''
  return last.split(/\[assistant]:/i)[0].trim()
}
