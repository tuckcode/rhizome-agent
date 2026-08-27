import { slugifyNoteStem } from './noteSlug'
import { isTransientAgentFailureText } from './sessionAutoDistill'

const MAX_TITLE_LEN = 72
const MAX_SLUG_LEN = 48
const FALLBACK_TITLE = 'Promoted from chat'

export interface PromoteNoteFromChat {
  title: string
  path: string
  content: string
}

export type PromoteWriteResult =
  | { status: 'saved'; note: PromoteNoteFromChat }
  | { status: 'duplicate'; note: PromoteNoteFromChat }
  | { status: 'refused' }

/** Prefer the live session id; fall back to the session log path. */
export function promoteSessionFromHost(
  sessionId?: string | null,
  sessionPath?: string | null,
): string | undefined {
  const id = sessionId?.trim()
  if (id) return id
  const path = sessionPath?.trim()
  if (path) return path
  return undefined
}

function cleanTitleCandidate(raw: string): string {
  return raw
    .replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, '$1')
    .replace(/[`*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function capTitle(cleaned: string): string {
  if (cleaned.length <= MAX_TITLE_LEN) return cleaned
  return `${cleaned.slice(0, MAX_TITLE_LEN - 1).trimEnd()}…`
}

/** Clock stamps, not prose — never used as a promoted title. */
export function isRawTimestampTitle(value: string): boolean {
  const s = value.trim()
  return (
    /^\d{4}-\d{2}-\d{2}(?:[T ][\d:.+-]+Z?)?$/.test(s)
    || /^\d{8}$/.test(s)
    || /^\d{10,13}$/.test(s)
  )
}

function usableTitle(raw: string): string | null {
  const cleaned = cleanTitleCandidate(raw)
  if (!cleaned || isRawTimestampTitle(cleaned)) return null
  return capTitle(cleaned)
}

function firstHeadingTitle(text: string): string | null {
  for (const raw of text.split(/\r?\n/)) {
    const match = raw.trim().match(/^#{1,2}\s+(.+)$/)
    if (!match) continue
    const title = usableTitle(match[1])
    if (title) return title
  }
  return null
}

function firstSentenceTitle(text: string): string | null {
  const normalized = text.replace(/\r\n/g, '\n').trim()
  if (!normalized) return null
  const lines = normalized.split('\n')
  const start = lines.findIndex((line) => {
    const trimmed = line.trim()
    return Boolean(trimmed) && !/^#{1,6}\s/.test(trimmed)
  })
  if (start === -1) return null
  const source = lines.slice(start).join('\n').trim()
  const paragraph = source.split(/\n\s*\n/)[0]?.replace(/\s+/g, ' ').trim() ?? ''
  if (!paragraph) return null
  const sentenceMatch = paragraph.match(/^(.+?[.!?])(?:\s|$)/)
  return usableTitle(sentenceMatch?.[1] ?? paragraph)
}

/** First `#` / `##` heading, else a short first sentence. Never a raw timestamp. */
export function titleFromChatContent(text: string): string {
  return firstHeadingTitle(text) ?? firstSentenceTitle(text) ?? FALLBACK_TITLE
}

export function promoteNoteRelativePath(title: string, at: Date = new Date()): string {
  const stamp = [
    at.getFullYear(),
    String(at.getMonth() + 1).padStart(2, '0'),
    String(at.getDate()).padStart(2, '0'),
  ].join('')
  let stem = slugifyNoteStem(title)
  if (stem.length > MAX_SLUG_LEN) stem = stem.slice(0, MAX_SLUG_LEN).replace(/-+$/g, '') || 'note'
  return `raw/inbox/${stamp}-${stem}.md`
}

export function buildPromotedNoteMarkdown(
  text: string,
  title: string,
  at: Date = new Date(),
  session?: string | null,
): string {
  const body = text.trim()
  const yyyy = at.getFullYear()
  const mm = String(at.getMonth() + 1).padStart(2, '0')
  const dd = String(at.getDate()).padStart(2, '0')
  const date = `${yyyy}-${mm}-${dd}`
  const sessionValue = session?.trim()
  const frontmatter = [
    '---',
    `title: ${yamlDoubleQuoted(title)}`,
    'is_a: Note',
    `created: ${date}`,
    'source: prime-chat-promote',
    ...(sessionValue ? [`session: ${yamlDoubleQuoted(sessionValue)}`] : []),
    '---',
  ]
  return [
    ...frontmatter,
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
  options?: { session?: string | null },
): PromoteNoteFromChat {
  const title = titleFromChatContent(text)
  const path = promoteNoteRelativePath(title, at)
  const content = buildPromotedNoteMarkdown(text, title, at, options?.session)
  return { title, path, content }
}

/**
 * Write the promoted note, or refuse it.
 *
 * Two refusals. **Duplicate**: that relative path already exists, so promote
 * will not overwrite. **Refused**: the turn carries no assistant knowledge —
 * it is empty, or it is a transport/auth failure, or it is the placeholder
 * Chat renders when a turn produced nothing at all.
 *
 * That last case is C51: an empty turn still renders "… finished without
 * returning a reply" in the transcript, and promote happily wrote *that
 * sentence* to the vault as if it were the answer. The same predicate already
 * guards auto-distill, so both durable-write paths now refuse the same inputs
 * — a placeholder is not knowledge on either road into the vault.
 *
 * Callers inject existence + persist so this stays unit-testable.
 */
export async function writePromoteNoteFromChat(
  text: string,
  at: Date,
  options: {
    session?: string | null
    pathExists: (path: string) => Promise<boolean>
    persist: (note: PromoteNoteFromChat) => Promise<void>
  },
): Promise<PromoteWriteResult> {
  if (isTransientAgentFailureText(text)) {
    return { status: 'refused' }
  }
  const note = buildPromoteNoteFromChat(text, at, { session: options.session })
  if (await options.pathExists(note.path)) {
    return { status: 'duplicate', note }
  }
  await options.persist(note)
  return { status: 'saved', note }
}

function yamlDoubleQuoted(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}
