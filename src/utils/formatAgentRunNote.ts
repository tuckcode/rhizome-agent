/**
 * Rewrite a raw agent-run dump into a readable note at our save step.
 *
 * CLI agents often pass the whole terminal log as `create_note` content
 * ("[tool] Grep is running.", lifecycle lines, "agent: / mode:" in the
 * body). The reader wants the answer first, then one collapsed run log.
 */

export interface AgentRunToolRow {
  name: string
  target: string
  duration: string
  status: 'ok' | 'failed'
}

export interface FormattedAgentRunNote {
  title: string
  answer: string
  asked: string | null
  agent: string | null
  mode: string | null
  tools: AgentRunToolRow[]
  failedLifecycle: string[]
  duration: string | null
  rewritten: boolean
}

const TOOL_LINE =
  /^\[tool\]\s+(\S+)(?:\s+is running\.)?(?:\s+(.*?))?\s*$/i
const LIFECYCLE_LINE =
  /^\[(preparing|spawned|grok-auth|auth|lifecycle|init|shutdown)\]\s*(.*)$/i
const ANY_EVENT_LINE = /^\[([^\]]+)\]\s*(.*)$/
const AGENT_LINE = /^agent:\s+(.+)$/i
const MODE_LINE = /^mode:\s+(.+)$/i
const DURATION_LINE = /^(?:duration|elapsed):\s*(.+)$/i
const ASKING_LINE = /^(?:→|=>)\s+Asking\b[:\s]*(.*)$/i
const CLOCK = /\b(\d+m(?:\s*\d+s)?|\d+s)\b/i
const FAIL = /\b(fail(?:ed|ure)?|error|denied|timeout|refused|abort(?:ed)?)\b/i

export function looksLikeAgentRunLog(text: string): boolean {
  let events = 0
  let tools = 0
  let hasAgent = false
  let hasMode = false
  for (const raw of text.split(/\r?\n/)) {
    const line = stripBullet(raw)
    if (TOOL_LINE.test(line) || /^\[tool\]/i.test(line)) {
      events += 1
      tools += 1
      continue
    }
    if (LIFECYCLE_LINE.test(line)) {
      events += 1
      continue
    }
    if (AGENT_LINE.test(line)) hasAgent = true
    if (MODE_LINE.test(line)) hasMode = true
  }
  return events >= 2 || (tools >= 1 && hasAgent && hasMode)
}

export function formatAgentRunNote(
  text: string,
  fallbackTitle = 'Agent run',
): FormattedAgentRunNote {
  const { fields, body } = splitFrontmatter(text)
  const source = body.trim() ? body : text
  if (!looksLikeAgentRunLog(source) && !looksLikeAgentRunLog(text)) {
    return {
      title: firstHeading(source) ?? fields.title ?? fallbackTitle,
      answer: source.trim(),
      asked: null,
      agent: fields.agent ?? null,
      mode: fields.mode ?? null,
      tools: [],
      failedLifecycle: [],
      duration: null,
      rewritten: false,
    }
  }

  const tools = new Map<string, AgentRunToolRow>()
  const failedLifecycle: string[] = []
  const answerLines: string[] = []
  let asked: string | null = null
  let agent = fields.agent ?? null
  let mode = fields.mode ?? null
  let duration: string | null = null
  let heading: string | null = firstHeading(source) ?? fields.title ?? null

  for (const raw of source.split(/\r?\n/)) {
    const line = stripBullet(raw)
    if (!line) {
      if (answerLines.length > 0 && answerLines[answerLines.length - 1] !== '') {
        answerLines.push('')
      }
      continue
    }

    const asking = line.match(ASKING_LINE)
    if (asking) {
      asked = asking[1]?.trim() || line.replace(/^(?:→|=>)\s+/, '').trim()
      if (!heading && asked) heading = usableTitle(titleFromAsked(asked))
      continue
    }

    const agentMatch = line.match(AGENT_LINE)
    if (agentMatch) {
      agent = unquote(agentMatch[1].trim())
      continue
    }
    const modeMatch = line.match(MODE_LINE)
    if (modeMatch) {
      mode = unquote(modeMatch[1].trim())
      continue
    }

    const durationMatch = line.match(DURATION_LINE)
    if (durationMatch) {
      duration = durationMatch[1].trim()
      continue
    }

    const headingMatch = line.match(/^#\s+(.+)$/)
    if (headingMatch && !heading) {
      heading = usableTitle(headingMatch[1]) ?? headingMatch[1].trim()
      continue
    }

    const toolMatch = line.match(TOOL_LINE) ?? toolishLine(line)
    if (toolMatch) {
      const name = toolMatch[1]
      const rest = (toolMatch[2] ?? '').trim()
      const key = `${name}\0${targetFromRest(rest)}`
      const existing = tools.get(key)
      const status = FAIL.test(rest) ? 'failed' : existing?.status ?? 'ok'
      const target = targetFromRest(rest) || existing?.target || ''
      const toolDuration = clockIn(rest) || existing?.duration || ''
      tools.set(key, {
        name,
        target,
        duration: toolDuration,
        status,
      })
      continue
    }

    const life = line.match(LIFECYCLE_LINE) ?? lifecycleish(line)
    if (life) {
      if (FAIL.test(line)) failedLifecycle.push(line)
      continue
    }

    if (ANY_EVENT_LINE.test(line) && !/^\[\[/.test(line)) {
      if (FAIL.test(line)) failedLifecycle.push(line)
      continue
    }

    answerLines.push(raw.trimEnd())
  }

  const answer = collapseBlank(answerLines)
  const title = heading ?? firstSentenceTitle(answer) ?? fallbackTitle
  if (!duration) {
    const fromTools = [...tools.values()].map((row) => row.duration).filter(Boolean)
    if (fromTools.length === 1) duration = fromTools[0]
  }

  return {
    title,
    answer,
    asked,
    agent,
    mode,
    tools: [...tools.values()],
    failedLifecycle,
    duration,
    rewritten: true,
  }
}

/** Full note markdown: keep ordinary notes; rewrite run dumps. */
export function rewriteAgentRunNoteContent(
  content: string,
  fallbackTitle?: string,
): string {
  const formatted = formatAgentRunNote(content, fallbackTitle)
  if (!formatted.rewritten) return content
  const { fields, rawFrontmatter } = splitFrontmatter(content)
  const merged = { ...fields }
  if (formatted.agent) merged.agent = formatted.agent
  if (formatted.mode) merged.mode = formatted.mode
  if (formatted.title && !merged.title) merged.title = formatted.title
  if (!merged.type) merged.type = 'Note'

  const frontmatter = renderFrontmatter(merged, rawFrontmatter)
  const body = renderRunNoteBody(formatted)
  return `${frontmatter}\n\n${body}\n`
}

export function renderRunNoteBody(formatted: FormattedAgentRunNote): string {
  const parts = [`# ${formatted.title}`, '']
  if (formatted.answer) {
    parts.push(formatted.answer, '')
  }
  if (formatted.tools.length > 0 || formatted.failedLifecycle.length > 0) {
    parts.push(renderRunLog(formatted), '')
  }
  return parts.join('\n').trimEnd()
}

export function renderRunLog(formatted: FormattedAgentRunNote): string {
  const n = formatted.tools.length
  const summary = formatted.duration
    ? `Run log · ${n} tools · ${formatted.duration}`
    : `Run log · ${n} tools`
  const rows = formatted.tools.map((row) => {
    const target = row.target || '—'
    const duration = row.duration || '—'
    return `${row.name} · ${target} · ${duration} · ${row.status}`
  })
  const inner = [
    formatted.asked ? `Asked: ${formatted.asked}` : null,
    rows.length > 0 ? ['```', ...rows, '```'].join('\n') : null,
    formatted.failedLifecycle.length > 0 ? formatted.failedLifecycle.join('\n') : null,
  ]
    .filter((block): block is string => Boolean(block))
    .join('\n\n')
  return `<details>\n<summary>${summary}</summary>\n\n${inner}\n\n</details>`
}

function stripBullet(raw: string): string {
  return raw.replace(/^\s*(?:[-*+]|\d+\.)\s+/, '').trim()
}

function toolishLine(line: string): RegExpMatchArray | null {
  if (!/^\[tool\]/i.test(line)) return null
  return line.match(/^\[tool\]\s+(\S+)\s*(.*)$/i)
}

function lifecycleish(line: string): RegExpMatchArray | null {
  return LIFECYCLE_LINE.test(line) ? line.match(LIFECYCLE_LINE) : null
}

function targetFromRest(rest: string): string {
  if (!rest) return ''
  const withoutClock = rest
    .replace(/\bis running\.\s*/i, '')
    .replace(FAIL, '')
    .replace(CLOCK, '')
    .replace(/\s+/g, ' ')
    .trim()
  return withoutClock
}

function clockIn(text: string): string {
  const match = text.match(CLOCK)
  return match?.[1] ?? ''
}

/** `local/rhizome: Vault Analysis` → `Vault Analysis`. */
function titleFromAsked(asked: string): string {
  const split = asked.match(/^[\w./-]+:\s+(.+)$/)
  return split?.[1]?.trim() || asked
}

function firstHeading(text: string): string | null {
  for (const raw of text.split(/\r?\n/)) {
    const match = raw.trim().match(/^#\s+(.+)$/)
    if (match) return usableTitle(match[1]) ?? match[1].trim()
  }
  return null
}

function firstSentenceTitle(text: string): string | null {
  const paragraph = text.split(/\n\s*\n/)[0]?.replace(/\s+/g, ' ').trim() ?? ''
  if (!paragraph) return null
  const sentence = paragraph.match(/^(.+?[.!?])(?:\s|$)/)
  return usableTitle(sentence?.[1] ?? paragraph)
}

function usableTitle(raw: string): string | null {
  const cleaned = raw.replace(/\s+/g, ' ').trim()
  if (!cleaned || cleaned.length > 80) return cleaned ? `${cleaned.slice(0, 79).trimEnd()}…` : null
  return cleaned
}

function collapseBlank(lines: string[]): string {
  return lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function unquote(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"'))
    || (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1).replace(/\\"/g, '"')
  }
  return value
}

export function splitFrontmatter(text: string): {
  fields: Record<string, string>
  body: string
  rawFrontmatter: string | null
} {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (!match) return { fields: {}, body: text, rawFrontmatter: null }
  const rawFrontmatter = match[1]
  const fields: Record<string, string> = {}
  for (const line of rawFrontmatter.split(/\r?\n/)) {
    const field = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/)
    if (!field) continue
    fields[field[1]] = unquote(field[2].trim())
  }
  return { fields, body: text.slice(match[0].length), rawFrontmatter }
}

function renderFrontmatter(
  fields: Record<string, string>,
  rawFrontmatter: string | null,
): string {
  const keys = rawFrontmatter
    ? uniqueKeys(rawFrontmatter, fields)
    : ['title', 'type', 'agent', 'mode'].filter((key) => fields[key])
  const lines = keys
    .filter((key) => fields[key])
    .map((key) => `${key}: ${yamlDoubleQuoted(fields[key])}`)
  return `---\n${lines.join('\n')}\n---`
}

function uniqueKeys(rawFrontmatter: string, fields: Record<string, string>): string[] {
  const keys: string[] = []
  for (const line of rawFrontmatter.split(/\r?\n/)) {
    const field = line.match(/^([A-Za-z][\w-]*):/)
    if (field && !keys.includes(field[1])) keys.push(field[1])
  }
  for (const extra of ['agent', 'mode', 'title', 'type']) {
    if (fields[extra] && !keys.includes(extra)) keys.push(extra)
  }
  return keys
}

function yamlDoubleQuoted(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}
