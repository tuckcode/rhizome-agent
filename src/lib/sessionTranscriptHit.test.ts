import { describe, expect, it, vi } from 'vitest'
import {
  applyTranscriptHitScroll,
  TRANSCRIPT_HIT_TEST_ID,
  transcriptHitAnchorProps,
} from './sessionTranscriptHit'

describe('transcriptHitAnchorProps', () => {
  it('is inert when the turn has no transcript index', () => {
    expect(transcriptHitAnchorProps(undefined, 4)).toEqual({ style: {} })
  })

  it('marks the index without highlight when another turn is focused', () => {
    expect(transcriptHitAnchorProps(2, 4)).toEqual({
      'data-transcript-index': 2,
      style: {},
    })
  })

  it('highlights the matching turn', () => {
    expect(transcriptHitAnchorProps(4, 4)).toEqual({
      'data-transcript-index': 4,
      'data-transcript-hit': 'true',
      'data-testid': TRANSCRIPT_HIT_TEST_ID,
      style: {
        outline: '2px solid var(--accent-blue)',
        outlineOffset: 2,
      },
    })
  })
})

describe('applyTranscriptHitScroll', () => {
  it('leaves follow-the-stream alone when no hit is focused', () => {
    const following = { current: true }
    const scrollIntoView = vi.fn()

    expect(applyTranscriptHitScroll(document, null, following)).toBe(false)
    expect(following.current).toBe(true)
    expect(scrollIntoView).not.toHaveBeenCalled()
  })

  it('stops following and scrolls the matching turn', () => {
    const following = { current: true }
    const target = document.createElement('div')
    target.setAttribute('data-transcript-index', '4')
    target.scrollIntoView = vi.fn()
    const container = document.createElement('div')
    container.append(target)

    expect(applyTranscriptHitScroll(container, 4, following)).toBe(true)
    expect(following.current).toBe(false)
    expect(target.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' })
  })
})
