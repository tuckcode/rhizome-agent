import { describe, expect, it } from 'vitest'
import { latestAssistantMessageIndex } from './latestAssistantMessage'

describe('latestAssistantMessageIndex', () => {
  it('returns -1 when nothing has an assistant reply yet', () => {
    expect(latestAssistantMessageIndex([])).toBe(-1)
    expect(latestAssistantMessageIndex([{}])).toBe(-1)
  })

  it('marks only the newest assistant reply', () => {
    expect(latestAssistantMessageIndex([
      { response: 'first' },
      { response: 'second' },
    ])).toBe(1)
  })

  it('moves onto a new streaming turn after send', () => {
    expect(latestAssistantMessageIndex([
      { response: 'old reply' },
      { isStreaming: true },
    ])).toBe(1)
  })

  it('stays on the previous reply until the new turn starts answering', () => {
    expect(latestAssistantMessageIndex([
      { response: 'old reply' },
      {},
    ])).toBe(0)
  })

  it('skips compact/local system markers', () => {
    expect(latestAssistantMessageIndex([
      { response: 'reply' },
      { localMarker: 'Compacted this conversation' },
    ])).toBe(0)
  })
})
