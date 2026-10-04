/**
 * A passage copied from an agent reply into the composer.
 * The composer stores it as one token. The chip shows the words.
 * Send turns the token into a quote the model can read, with the reply id.
 */

export interface ReplyQuote {
  messageId: string
  text: string
}

const QUOTE_PATTERN = /«quote:([^»]*)»/g

export function replyQuoteToken(quote: ReplyQuote): string {
  const payload = encodeURIComponent(JSON.stringify({
    messageId: quote.messageId,
    text: quote.text,
  }))
  return `«quote:${payload}»`
}

export function decodeReplyQuote(payload: string): ReplyQuote | null {
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(payload))
    if (!parsed || typeof parsed !== 'object') return null
    const record = parsed as { messageId?: unknown; text?: unknown }
    if (typeof record.text !== 'string' || record.text.length === 0) return null
    if (record.messageId !== undefined && typeof record.messageId !== 'string') return null
    return {
      messageId: typeof record.messageId === 'string' ? record.messageId : '',
      text: record.text,
    }
  } catch {
    return null
  }
}

export function readReplyQuoteToken(token: string): ReplyQuote | null {
  const match = /^«quote:([^»]*)»$/.exec(token)
  if (!match) return null
  return decodeReplyQuote(match[1])
}

/** Replace quote tokens with the words and the reply id. */
export function expandReplyQuotes(value: string): string {
  return value.replace(QUOTE_PATTERN, (token, payload: string) => {
    const quote = decodeReplyQuote(payload)
    if (!quote) return token
    const cited = quote.messageId ? ` (reply: ${quote.messageId})` : ''
    return `“${quote.text}”${cited}`
  })
}

export function focusQuotedReply(messageId: string): void {
  if (!messageId) return
  const escaped = typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
    ? CSS.escape(messageId)
    : messageId.replace(/"/g, '')
  const node = document.querySelector(`[data-reply-id="${escaped}"]`)
  if (!(node instanceof HTMLElement)) return
  node.scrollIntoView({ block: 'nearest' })
}
