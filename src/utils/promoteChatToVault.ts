import { slugifyNoteStem } from './noteSlug'

const MAX_TITLE_LEN = 72
const MAX_SLUG_LEN = 48

/** First markdown heading or first non-empty line, trimmed for a note title. */
export function titleFromChatContent(text: string): string {
  const lines = text.split(/\r?\n/)
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    const heading = line.match(/^#{1,6}\s+(.+)$/)
    const candidate = (heading?.[1] ?? line).trim()
    if (!candidate) continue
    const cleaned = candidate
      .replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, '$1')
      .replace(/[`*_~]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    if (!cleaned) continue
    if (cleaned.length <= MAX_TITLE_LEN) return cleaned
    return `${cleaned.slice(0, MAX_TITLE_LEN - 1).trimEnd()}…`
  }
  return 'Promoted from chat'
}

export function promoteNoteRelativePath(title: string, at: Date = new Date()): string {
  const stamp = [
    at.getFullYear(),
    String(at.getMonth() + 1).padStart(2, '0'),
    String(at.getDate()).padStart(2, '0'),
  ].join('')
  let stem = slugifyNoteStem(title)
  if (stem.length > MAX_SLUG_LEN) stem = stem.slice(0, MAX_SLUG_LEN).replace(/-+$/g, '') || 'note'
  return `inbox/${stamp}-${stem}.md`
}

export function buildPromotedNoteMarkdown(text: string, title: string, at: Date = new Date()): string {
  const body = text.trim()
  const yyyy = at.getFullYear()
  const mm = String(at.getMonth() + 1).padStart(2, '0')
  const dd = String(at.getDate()).padStart(2, '0')
  const date = `${yyyy}-${mm}-${dd}`
  return [
    '---',
    `title: ${yamlDoubleQuoted(title)}`,
    'is_a: Note',
    `created: ${date}`,
    'source: prime-chat-promote',
    '---',
    '',
    `# ${title}`,
    '',
    body,
    '',
  ].join('\n')
}

export function buildPromoteNoteFromChat(
  text: string,
  at: Date = new Date(),
): { title: string; path: string; content: string } {
  const title = titleFromChatContent(text)
  const path = promoteNoteRelativePath(title, at)
  const content = buildPromotedNoteMarkdown(text, title, at)
  return { title, path, content }
}

function yamlDoubleQuoted(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}
