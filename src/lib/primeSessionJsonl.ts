/**
 * Test / dogfood harness for Prime-shaped session logs.
 *
 * Production replay still goes through `read_prime_session_transcript`.
 * CI boxes often have an empty `~/.prime/agent/sessions` directory, so the
 * shipped fixtures plus this parser let the Rhizome index prove it can read
 * a real log shape without Prime installed and without forking the harness.
 */

import type { PrimeTranscriptItem, PrimeTranscriptTool } from './primeTranscriptToConversation'

interface JsonlEvent {
  type?: unknown
  id?: unknown
  parentId?: unknown
  fromId?: unknown
  timestamp?: unknown
  summary?: unknown
  tokensBefore?: unknown
  provider?: unknown
  modelId?: unknown
  message?: unknown
}

interface ContentBlock {
  type?: unknown
  text?: unknown
  name?: unknown
  id?: unknown
  arguments?: unknown
  input?: unknown
}

/**
 * Turn one JSONL session log into the transcript items app search indexes.
 *
 * Malformed lines are skipped, matching Prime's on-disk reader. Status,
 * session header, and other non-transcript event types are dropped.
 */
export function primeTranscriptItemsFromJsonl(jsonl: string): PrimeTranscriptItem[] {
  const items: PrimeTranscriptItem[] = []
  for (const line of jsonl.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const event = parseEvent(trimmed)
    if (!event) continue
    const item = itemFromEvent(event)
    if (item) items.push(item)
  }
  return items
}

function parseEvent(line: string): JsonlEvent | null {
  try {
    const value: unknown = JSON.parse(line)
    if (!value || typeof value !== 'object') return null
    return value as JsonlEvent
  } catch {
    return null
  }
}

function itemFromEvent(event: JsonlEvent): PrimeTranscriptItem | null {
  switch (asString(event.type)) {
    case 'message':
      return messageItem(event)
    case 'compaction':
      return {
        kind: 'compaction',
        id: optionalString(event.id),
        parentId: optionalString(event.parentId),
        timestamp: optionalString(event.timestamp),
        summary: optionalString(event.summary),
        tokensBefore: asNumber(event.tokensBefore),
      }
    case 'model_change':
      return {
        kind: 'modelChange',
        id: optionalString(event.id),
        parentId: optionalString(event.parentId),
        timestamp: optionalString(event.timestamp),
        provider: optionalString(event.provider),
        modelId: optionalString(event.modelId),
      }
    case 'branch_summary':
      return {
        kind: 'branchSummary',
        id: optionalString(event.id),
        parentId: optionalString(event.parentId),
        fromId: optionalString(event.fromId),
        summary: optionalString(event.summary),
      }
    default:
      return null
  }
}

function messageItem(event: JsonlEvent): PrimeTranscriptItem | null {
  const message = event.message
  if (!message || typeof message !== 'object') return null
  const body = message as { role?: unknown; content?: unknown; timestamp?: unknown }
  const role = asString(body.role)
  const content = body.content ?? null
  return {
    kind: 'message',
    id: optionalString(event.id),
    parentId: optionalString(event.parentId),
    tools: toolsFromContent(content),
    message: {
      role,
      content,
      timestamp: asNumber(body.timestamp),
      text: textFromContent(content),
    },
  }
}

function textFromContent(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .filter(isRecord)
    .filter((block) => asString(block.type) === 'text' && typeof block.text === 'string')
    .map((block) => String(block.text))
    .join('')
}

function toolsFromContent(content: unknown): PrimeTranscriptTool[] {
  if (!Array.isArray(content)) return []
  return content.filter(isRecord).flatMap((block): PrimeTranscriptTool[] => {
    const type = asString(block.type)
    if (type !== 'toolCall' && type !== 'tool_use') return []
    const args = block.arguments ?? block.input
    const path = isRecord(args) && typeof args.path === 'string' ? args.path : undefined
    const name = asString(block.name) || 'tool'
    return [{
      id: optionalString(block.id),
      tool: name,
      path,
      detail: path ? `${name} ${path}` : name,
    }]
  })
}

function isRecord(value: unknown): value is ContentBlock & Record<string, unknown> {
  return !!value && typeof value === 'object'
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}
