/**
 * Display-only shaping for Chat thinking. Do not persist the result.
 *
 * Models often glue the next sentence onto the period (`end.Next`) and
 * still emit real line breaks. Keep the breaks. Split only the glued join.
 * Single newlines become markdown hard breaks so MarkdownContent shows
 * them instead of flattening the stream into one paragraph.
 *
 * Some turns echo the client-owned `<conversation_history>` prompt into
 * thinking. That dump is not reasoning — strip it before the fold opens.
 */
export function normalizeReasoningDisplay(text: string): string {
  const withoutHistory = stripConversationHistoryEcho(text)
  const withSentenceGaps = withoutHistory.replace(/\.([A-Z])/g, '. $1')
  return preserveNewlinesAsMarkdownBreaks(withSentenceGaps)
}

function stripConversationHistoryEcho(text: string): string {
  const open = ['<', 'conversation_history', '>'].join('')
  const close = ['</', 'conversation_history', '>'].join('')
  const escapedOpen = open.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const escapedClose = close.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const block = new RegExp(`${escapedOpen}[\\s\\S]*?${escapedClose}`, 'g')
  let next = text.replace(block, '')
  const leftover = next.indexOf(open)
  if (leftover !== -1) {
    next = next.slice(0, leftover)
  }
  return next.replace(/^\s+|\s+$/g, '').replace(/\n{3,}/g, '\n\n')
}

function preserveNewlinesAsMarkdownBreaks(text: string): string {
  const fence = /```[\s\S]*?```/g
  const pieces: string[] = []
  let last = 0
  for (const match of text.matchAll(fence)) {
    const start = match.index ?? 0
    pieces.push(hardBreakSingleNewlines(text.slice(last, start)))
    pieces.push(match[0])
    last = start + match[0].length
  }
  pieces.push(hardBreakSingleNewlines(text.slice(last)))
  return pieces.join('')
}

function hardBreakSingleNewlines(text: string): string {
  return text.replace(/([^\n])\n(?!\n)/g, '$1  \n')
}
