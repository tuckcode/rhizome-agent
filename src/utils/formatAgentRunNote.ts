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
const TOOL_RUNNING_LINE = /^\[tool\]\s+\S+.*\bis running\.\s*$/i
const LIFECYCLE_LINE =
  /^\[(preparing|spawned|grok-auth|auth|lifecycle|init|shutdown)\]\s*(.*)$/i
const AGENT_LINE = /^agent:\s+(.+)$/i
const MODE_LINE = /^mode:\s+(.+)$/i
const DURATION_LINE = /^(?:duration|elapsed):\s*(.+)$/i
const ASKING_LINE = /^(?:→|=>)\s+Asking\b[:\s]*(.*)$/i
const CLOCK = /\b(\d+m(?:\s*\d+s)?|\d+s)\b/i
const FAIL = /\b(fail(?:ed|ure)?|error|denied|timeout|refused|abort(?:ed)?)\b/i
const TASK_LINE = /^\s*(?:[-*+]|\d+\.)\s+\[[ xX]\]/
const LINK_START = /^\s*(?:\[[^\]]+\]\(|\[\[[^\]]+\]\]|<(?:https?:|mailto:))/
const FENCE_LINE = /^(`{3,}|~{3,})/

export function looksLikeAgentRunLog(text: string): boolean {
  const body = splitFrontmatter(text).body
  let running = 0
  let lifecycle = 0
  let hasAgent = false
  let hasMode = false
  let inFence = false
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim()
    if (FENCE_LINE.test(line)) {
      inFence = !inFence
      continue
    }
    if (inFence || isQuotedLine(line)) continue
    if (TOOL_RUNNING_LINE.test(line)) running += 1
    if (LIFECYCLE_LINE.test(line)) lifecycle += 1
    if (AGENT_LINE.test(line)) hasAgent = true
    if (MODE_LINE.test(line)) hasMode = true
  }
  return running >= 1 && (lifecycle >= 1 || (hasAgent && hasMode))
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
  let inFence = false
  let consumedTitleHeading = false

  for (const raw of source.split(/\r?\n/)) {
    const trimmed = raw.trim()
    if (FENCE_LINE.test(trimmed)) {
      inFence = !inFence
      answerLines.push(raw.trimEnd())
      continue
    }
    if (inFence) {
      answerLines.push(raw.trimEnd())
      continue
    }

    if (!trimmed) {
      if (answerLines.length > 0 && answerLines[answerLines.length - 1] !== '') {
        answerLines.push('')
      }
      continue
    }

    if (TASK_LINE.test(raw) || LINK_START.test(raw)) {
      answerLines.push(raw.trimEnd())
      continue
    }

    const asking = trimmed.match(ASKING_LINE)
    if (asking) {
      asked = asking[1]?.trim() || trimmed.replace(/^(?:→|=>)\s+/, '').trim()
      if (!heading && asked) heading = usableTitle(titleFromAsked(asked))
      continue
    }

    const agentMatch = trimmed.match(AGENT_LINE)
    if (agentMatch) {
      agent = unquote(agentMatch[1].trim())
      continue
    }
    const modeMatch = trimmed.match(MODE_LINE)
    if (modeMatch) {
      mode = unquote(modeMatch[1].trim())
      continue
    }

    const durationMatch = trimmed.match(DURATION_LINE)
    if (durationMatch) {
      duration = durationMatch[1].trim()
      continue
    }

    const headingMatch = trimmed.match(/^#\s+(.+)$/)
    if (headingMatch && !consumedTitleHeading) {
      heading = heading ?? usableTitle(headingMatch[1]) ?? headingMatch[1].trim()
      consumedTitleHeading = true
      continue
    }

    const toolMatch = !isQuotedLine(trimmed)
      ? (trimmed.match(TOOL_LINE) ?? toolishLine(trimmed))
      : null
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

    if (!isQuotedLine(trimmed) && LIFECYCLE_LINE.test(trimmed)) {
      if (FAIL.test(trimmed)) failedLifecycle.push(trimmed)
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
  const { rawFrontmatter } = splitFrontmatter(content)
  const frontmatter = keepFrontmatter(
    rawFrontmatter,
    formatted.agent,
    formatted.mode,
    formatted.title,
  )
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

function toolCountLabel(n: number): string {
  return n === 1 ? 'tool' : 'tools'
}

export function renderRunLog(formatted: FormattedAgentRunNote): string {
  const n = formatted.tools.length
  const summary = formatted.duration
    ? `Run log · ${n} ${toolCountLabel(n)} · ${formatted.duration}`
    : `Run log · ${n} ${toolCountLabel(n)}`
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

function isQuotedLine(line: string): boolean {
  const trimmed = line.trim()
  if (FENCE_LINE.test(trimmed)) return false
  return (
    (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2)
    || (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2)
    || (trimmed.startsWith('`') && trimmed.endsWith('`') && trimmed.length >= 2)
  )
}

function toolishLine(line: string): RegExpMatchArray | null {
  if (!/^\[tool\]/i.test(line)) return null
  return line.match(/^\[tool\]\s+(\S+)\s*(.*)$/i)
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
  let inFence = false
  for (const raw of text.split(/\r?\n/)) {
    const trimmed = raw.trim()
    if (FENCE_LINE.test(trimmed)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    const match = trimmed.match(/^#\s+(.+)$/)
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

function keepFrontmatter(
  rawFrontmatter: string | null,
  agent: string | null,
  mode: string | null,
  title: string,
): string {
  if (!rawFrontmatter) {
    const lines = [
      '---',
      `title: ${yamlDoubleQuoted(title)}`,
      'type: Note',
      ...(agent ? [`agent: ${yamlDoubleQuoted(agent)}`] : []),
      ...(mode ? [`mode: ${yamlDoubleQuoted(mode)}`] : []),
      '---',
    ]
    return lines.join('\n')
  }
  const extras: string[] = []
  if (agent && !hasYamlKey(rawFrontmatter, 'agent')) extras.push(`agent: ${yamlDoubleQuoted(agent)}`)
  if (mode && !hasYamlKey(rawFrontmatter, 'mode')) extras.push(`mode: ${yamlDoubleQuoted(mode)}`)
  const kept = rawFrontmatter.replace(/\s+$/, '')
  const block = extras.length > 0 ? `${kept}\n${extras.join('\n')}` : kept
  return `---\n${block}\n---`
}

function hasYamlKey(rawFrontmatter: string, key: string): boolean {
  return rawFrontmatter.split(/\r?\n/).some((line) => {
    const colon = line.indexOf(':')
    return colon > 0 && line.slice(0, colon) === key
  })
}

function yamlDoubleQuoted(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}
