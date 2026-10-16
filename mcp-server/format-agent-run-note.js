/**
 * Same rewrite as src/utils/formatAgentRunNote.ts. CLI agents hit create_note
 * through this server, so the save step has to live here too.
 */

const TOOL_LINE = /^\[tool\]\s+(\S+)(?:\s+is running\.)?(?:\s+(.*?))?\s*$/i
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

export function looksLikeAgentRunLog(text) {
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

export function rewriteAgentRunNoteContent(content, fallbackTitle = 'Agent run') {
  const formatted = formatAgentRunNote(content, fallbackTitle)
  if (!formatted.rewritten) return content
  const { rawFrontmatter } = splitFrontmatter(content)
  return `${keepFrontmatter(rawFrontmatter, formatted.agent, formatted.mode, formatted.title)}\n\n${renderRunNoteBody(formatted)}\n`
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
      const existing = tools.get(`${name}\0${targetFromRest(rest)}`)
      tools.set(`${name}\0${targetFromRest(rest)}`, {
        name,
        target: targetFromRest(rest) || existing?.target || '',
        duration: clockIn(rest) || existing?.duration || '',
        status: FAIL.test(rest) ? 'failed' : existing?.status ?? 'ok',
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

function toolCountLabel(n) {
  return n === 1 ? 'tool' : 'tools'
}

function renderRunLog(formatted) {
  const n = formatted.tools.length
  const summary = formatted.duration
    ? `Run log · ${n} ${toolCountLabel(n)} · ${formatted.duration}`
    : `Run log · ${n} ${toolCountLabel(n)}`
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

function isQuotedLine(line) {
  const trimmed = line.trim()
  if (FENCE_LINE.test(trimmed)) return false
  return (
    (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2)
    || (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2)
    || (trimmed.startsWith('`') && trimmed.endsWith('`') && trimmed.length >= 2)
  )
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

function keepFrontmatter(rawFrontmatter, agent, mode, title) {
  if (!rawFrontmatter) {
    return [
      '---',
      `title: ${yamlDoubleQuoted(title)}`,
      'type: Note',
      ...(agent ? [`agent: ${yamlDoubleQuoted(agent)}`] : []),
      ...(mode ? [`mode: ${yamlDoubleQuoted(mode)}`] : []),
      '---',
    ].join('\n')
  }
  const extras = []
  if (agent && !hasYamlKey(rawFrontmatter, 'agent')) extras.push(`agent: ${yamlDoubleQuoted(agent)}`)
  if (mode && !hasYamlKey(rawFrontmatter, 'mode')) extras.push(`mode: ${yamlDoubleQuoted(mode)}`)
  const kept = rawFrontmatter.replace(/\s+$/, '')
  const block = extras.length > 0 ? `${kept}\n${extras.join('\n')}` : kept
  return `---\n${block}\n---`
}

function hasYamlKey(rawFrontmatter, key) {
  return rawFrontmatter.split(/\r?\n/).some((line) => {
    const colon = line.indexOf(':')
    return colon > 0 && line.slice(0, colon) === key
  })
}

function yamlDoubleQuoted(value) {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}
