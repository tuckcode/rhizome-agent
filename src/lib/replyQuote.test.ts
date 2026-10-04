import { describe, expect, it } from 'vitest'
import { expandReplyQuotes, readReplyQuoteToken, replyQuoteToken } from './replyQuote'

describe('reply quotes', () => {
  it('round-trips the excerpt and the reply id', () => {
    const token = replyQuoteToken({ messageId: 'msg-1', text: 'The path is blocked.' })
    expect(readReplyQuoteToken(token)).toEqual({
      messageId: 'msg-1',
      text: 'The path is blocked.',
    })
  })

  it('turns a token into a quote the model can read', () => {
    const token = replyQuoteToken({ messageId: 'msg-1', text: 'The path is blocked.' })
    expect(expandReplyQuotes(`Hello ${token} world`)).toBe(
      'Hello “The path is blocked.” (reply: msg-1) world',
    )
  })

  it('quotes text that has no reply id', () => {
    const token = replyQuoteToken({ messageId: '', text: 'blocked' })
    expect(expandReplyQuotes(token)).toBe('“blocked”')
  })
})
