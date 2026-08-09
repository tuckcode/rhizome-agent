/**
 * Pure helpers for the menu-bar companion's quick-capture.
 * Turns raw capture text (+ optional type) into a note path + Markdown body
 * for `create_note_content`. No Tauri, no I/O — unit-testable in isolation.
 */

/** Slugify a title into a filename stem: lowercase, alnum + single hyphens. */
export function captureSlug(title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return slug || 'note'
}

/**
 * First non-empty line becomes the title (H1). The rest is the body.
 * A quick capture is usually one line, so body is often empty.
 */
export function splitCapture(text: string): { title: string; body: string } {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const firstIdx = lines.findIndex((l) => l.trim().length > 0)
  if (firstIdx === -1) return { title: '', body: '' }
  const title = lines[firstIdx].trim()
  const body = lines
    .slice(firstIdx + 1)
    .join('\n')
    .trim()
  return { title, body }
}

export interface CaptureNote {
  /** Vault-relative path, always under the inbox folder. */
  path: string
  /** Full Markdown content: optional frontmatter + H1 title + body. */
  content: string
}

/**
 * Build the note to write for a capture. `type` (a vault type name) is written
 * as `type:` frontmatter when present; otherwise the note carries no type and
 * lands as a plain capture in the Inbox. `nowIso` is injected (never read from
 * the clock here) so the result is deterministic for tests and callers stamp
 * the real time.
 */
export function buildCaptureNote(
  text: string,
  type: string | null,
  nowIso: string,
): CaptureNote | null {
  const { title, body } = splitCapture(text)
  if (!title) return null

  const stem = captureSlug(title)
  const stamp = nowIso.slice(0, 10) // YYYY-MM-DD, keeps filenames stable/sortable
  const path = `raw/inbox/${stamp}-${stem}.md`

  const frontmatter = type ? `---\ntype: ${type}\n---\n\n` : ''
  const bodyBlock = body ? `\n\n${body}\n` : '\n'
  const content = `${frontmatter}# ${title}${bodyBlock}`

  return { path, content }
}
