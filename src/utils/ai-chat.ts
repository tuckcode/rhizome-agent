/**
 * AI Chat utilities — token estimation and conversation history.
 */

/** Rough token estimate: ~4 chars per token for English text. */
export function estimateTokens(text: string | number): number {
  const len = typeof text === 'number' ? text : text.length
  return Math.ceil(len / 4)
}

// --- Message types ---

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  id: string
}

let msgIdCounter = 0
export function nextMessageId(): string {
  return `msg-${++msgIdCounter}-${Date.now()}`
}

// --- Conversation history ---

/** Max tokens of history to include in each request. */
export const MAX_HISTORY_TOKENS = 100_000
const CONVERSATION_HISTORY_OPEN_MARKER = ['<', 'conversation_history', '>'].join('')
const CONVERSATION_HISTORY_CLOSE_MARKER = ['</', 'conversation_history', '>'].join('')

/** Keep the most recent messages that fit within `maxTokens`. Drops oldest first. */
export function trimHistory(history: ChatMessage[], maxTokens: number): ChatMessage[] {
  let tokenCount = 0
  const newestFirst = [...history].reverse()
  const keptNewestFirst: ChatMessage[] = []
  for (const message of newestFirst) {
    const tokens = estimateTokens(message.content)
    if (tokenCount + tokens > maxTokens) break
    keptNewestFirst.push(message)
    tokenCount += tokens
  }
  return keptNewestFirst.reverse()
}

/** Format conversation history + new message into a single prompt for the CLI. */
export function formatMessageWithHistory(history: ChatMessage[], newMessage: string): string {
  if (history.length === 0) return newMessage

  const lines = history.map(m => `[${m.role}]: ${m.content}`)
  lines.push(`[user]: ${newMessage}`)

  return `${CONVERSATION_HISTORY_OPEN_MARKER}\n${lines.join('\n\n')}\n${CONVERSATION_HISTORY_CLOSE_MARKER}\n\nContinue the conversation. Respond only to the latest [user] message.`
}

/** The line the person typed, when a log stored the whole history prompt. */
export function visibleUserText(text: string): string {
  const start = text.indexOf(CONVERSATION_HISTORY_OPEN_MARKER)
  if (start < 0) return text
  const innerStart = start + CONVERSATION_HISTORY_OPEN_MARKER.length
  const end = text.indexOf(CONVERSATION_HISTORY_CLOSE_MARKER, innerStart)
  const inner = (end < 0 ? text.slice(innerStart) : text.slice(innerStart, end)).trim()
  const parts = inner.split(/\[user]:\s*/i).slice(1)
  const last = (parts.at(-1) ?? '').split(/\[assistant]:/i)[0].trim()
  return last
}
