/**
 * Same rewrite as src/utils/formatAgentRunNote.ts. CLI agents hit create_note
 * through this server, so the save step has to live here too.
 */

const TOOL_LINE = /^\[tool\]\s+(\S+)(?:\s+is running\.)?(?:\s+(.*?))?\s*$/i
const LIFECYCLE_LINE =
  /^\[(preparing|spawned|grok-auth|auth|lifecycle|init|shutdown)\]\s*(.*)$/i
const ANY_EVENT_LINE = /^\[([^\]]+)\]\s*(.*)$/
const AGENT_LINE = /^agent:\s+(.+)$/i
const MODE_LINE = /^mode:\s+(.+)$/i
const DURATION_LINE = /^(?:duration|elapsed):\s*(.+)$/i
const ASKING_LINE = /^(?:→|=>)\s+Asking\b[:\s]*(.*)$/i
const CLOCK = /\b(\d+m(?:\s*\d+s)?|\d+s)\b/i
const FAIL = /\b(fail(?:ed|ure)?|error|denied|timeout|refused|abort(?:ed)?)\b/i

export function looksLikeAgentRunLog(text) {
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

export function rewriteAgentRunNoteContent(content, fallbackTitle = 'Agent run') {
  const formatted = formatAgentRunNote(content, fallbackTitle)
  if (!formatted.rewritten) return content
  const { fields, rawFrontmatter } = splitFrontmatter(content)
  const merged = { ...fields }
  if (formatted.agent) merged.agent = formatted.agent
  if (formatted.mode) merged.mode = formatted.mode
  if (formatted.title && !merged.title) merged.title = formatted.title
  if (!merged.type) merged.type = 'Note'
  return `${renderFrontmatter(merged, rawFrontmatter)}\n\n${renderRunNoteBody(formatted)}\n`
}

function formatAgentRunNote(text, fallbackTitle) {
  const { fields, body } = splitFrontmatter(text)
  const source = body.trim() ? body : text
  if (!looksLikeAgentRunLog(source) && !looksLikeAgentRunLog(text)) {
    return { rewritten: false }
  }

  const tools = new Map()
  const failedLifecycle = []
  const answerLines = []
  let asked = null
  let agent = fields.agent ?? null
  let mode = fields.mode ?? null
  let duration = null
  let heading = firstHeading(source) ?? fields.title ?? null

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
      tools.set(key, {
        name,
        target: targetFromRest(rest) || existing?.target || '',
        duration: clockIn(rest) || existing?.duration || '',
        status: FAIL.test(rest) ? 'failed' : existing?.status ?? 'ok',
      })
      continue
    }

    if (LIFECYCLE_LINE.test(line)) {
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
  if (!duration) {
    const fromTools = [...tools.values()].map((row) => row.duration).filter(Boolean)
    if (fromTools.length === 1) duration = fromTools[0]
  }

  return {
    title: heading ?? firstSentenceTitle(answer) ?? fallbackTitle,
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

function renderRunNoteBody(formatted) {
  const parts = [`# ${formatted.title}`, '']
  if (formatted.answer) parts.push(formatted.answer, '')
  if (formatted.tools.length > 0 || formatted.failedLifecycle.length > 0) {
    parts.push(renderRunLog(formatted), '')
  }
  return parts.join('\n').trimEnd()
}

function renderRunLog(formatted) {
  const n = formatted.tools.length
  const summary = formatted.duration
    ? `Run log · ${n} tools · ${formatted.duration}`
    : `Run log · ${n} tools`
  const rows = formatted.tools.map((row) => (
    `${row.name} · ${row.target || '—'} · ${row.duration || '—'} · ${row.status}`
  ))
  const inner = [
    formatted.asked ? `Asked: ${formatted.asked}` : null,
    rows.length > 0 ? ['```', ...rows, '```'].join('\n') : null,
    formatted.failedLifecycle.length > 0 ? formatted.failedLifecycle.join('\n') : null,
  ].filter(Boolean).join('\n\n')
  return `<details>\n<summary>${summary}</summary>\n\n${inner}\n\n</details>`
}

function stripBullet(raw) {
  return raw.replace(/^\s*(?:[-*+]|\d+\.)\s+/, '').trim()
}

function toolishLine(line) {
  if (!/^\[tool\]/i.test(line)) return null
  return line.match(/^\[tool\]\s+(\S+)\s*(.*)$/i)
}

function targetFromRest(rest) {
  if (!rest) return ''
  return rest
    .replace(/\bis running\.\s*/i, '')
    .replace(FAIL, '')
    .replace(CLOCK, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function clockIn(text) {
  return text.match(CLOCK)?.[1] ?? ''
}

function titleFromAsked(asked) {
  return asked.match(/^[\w./-]+:\s+(.+)$/)?.[1]?.trim() || asked
}

function firstHeading(text) {
  for (const raw of text.split(/\r?\n/)) {
    const match = raw.trim().match(/^#\s+(.+)$/)
    if (match) return usableTitle(match[1]) ?? match[1].trim()
  }
  return null
}

function firstSentenceTitle(text) {
  const paragraph = text.split(/\n\s*\n/)[0]?.replace(/\s+/g, ' ').trim() ?? ''
  if (!paragraph) return null
  const sentence = paragraph.match(/^(.+?[.!?])(?:\s|$)/)
  return usableTitle(sentence?.[1] ?? paragraph)
}

function usableTitle(raw) {
  const cleaned = raw.replace(/\s+/g, ' ').trim()
  if (!cleaned) return null
  if (cleaned.length > 80) return `${cleaned.slice(0, 79).trimEnd()}…`
  return cleaned
}

function collapseBlank(lines) {
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

function unquote(value) {
  if (
    (value.startsWith('"') && value.endsWith('"'))
    || (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1).replace(/\\"/g, '"')
  }
  return value
}

function splitFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (!match) return { fields: {}, body: text, rawFrontmatter: null }
  const fields = {}
  for (const line of match[1].split(/\r?\n/)) {
    const field = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/)
    if (field) fields[field[1]] = unquote(field[2].trim())
  }
  return { fields, body: text.slice(match[0].length), rawFrontmatter: match[1] }
}

function renderFrontmatter(fields, rawFrontmatter) {
  const keys = rawFrontmatter
    ? uniqueKeys(rawFrontmatter, fields)
    : ['title', 'type', 'agent', 'mode'].filter((key) => fields[key])
  const lines = keys
    .filter((key) => fields[key])
    .map((key) => `${key}: ${yamlDoubleQuoted(fields[key])}`)
  return `---\n${lines.join('\n')}\n---`
}

function uniqueKeys(rawFrontmatter, fields) {
  const keys = []
  for (const line of rawFrontmatter.split(/\r?\n/)) {
    const field = line.match(/^([A-Za-z][\w-]*):/)
    if (field && !keys.includes(field[1])) keys.push(field[1])
  }
  for (const extra of ['agent', 'mode', 'title', 'type']) {
    if (fields[extra] && !keys.includes(extra)) keys.push(extra)
  }
  return keys
}

function yamlDoubleQuoted(value) {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}
