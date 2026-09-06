import { describe, expect, it } from 'vitest'
import {
  canBrowseComposerPromptHistory,
  emptyComposerPromptHistory,
  navigateComposerPromptHistory,
  pushComposerPrompt,
  MAX_COMPOSER_PROMPT_HISTORY,
} from './composerPromptHistory'

describe('composerPromptHistory', () => {
  it('pushes sent prompts and skips consecutive duplicates', () => {
    let state = emptyComposerPromptHistory()
    state = pushComposerPrompt(state, '  first  ')
    state = pushComposerPrompt(state, 'first')
    state = pushComposerPrompt(state, 'second')
    expect(state.entries).toEqual(['first', 'second'])
    expect(state.index).toBe(-1)
  })

  it('caps history length', () => {
    let state = emptyComposerPromptHistory()
    for (let i = 0; i < MAX_COMPOSER_PROMPT_HISTORY + 5; i += 1) {
      state = pushComposerPrompt(state, `p${i}`)
    }
    expect(state.entries).toHaveLength(MAX_COMPOSER_PROMPT_HISTORY)
    expect(state.entries[0]).toBe('p5')
  })

  it('only browses when empty or caret at start, never with suggestions open', () => {
    expect(canBrowseComposerPromptHistory({
      value: '',
      selectionStart: 0,
      selectionEnd: 0,
      suggestionsOpen: false,
    })).toBe(true)
    expect(canBrowseComposerPromptHistory({
      value: 'hello',
      selectionStart: 0,
      selectionEnd: 0,
      suggestionsOpen: false,
    })).toBe(true)
    expect(canBrowseComposerPromptHistory({
      value: 'hello',
      selectionStart: 2,
      selectionEnd: 2,
      suggestionsOpen: false,
    })).toBe(false)
    expect(canBrowseComposerPromptHistory({
      value: '',
      selectionStart: 0,
      selectionEnd: 0,
      suggestionsOpen: true,
    })).toBe(false)
  })

  it('ArrowUp recalls newest first and preserves the live draft for ArrowDown', () => {
    let state = emptyComposerPromptHistory()
    state = pushComposerPrompt(state, 'older')
    state = pushComposerPrompt(state, 'newer')

    const up1 = navigateComposerPromptHistory(state, 'up', 'drafting…')
    expect(up1.handled).toBe(true)
    expect(up1.text).toBe('newer')
    state = up1.state

    const up2 = navigateComposerPromptHistory(state, 'up', up1.text)
    expect(up2.text).toBe('older')
    state = up2.state

    const down1 = navigateComposerPromptHistory(state, 'down', up2.text)
    expect(down1.text).toBe('newer')
    state = down1.state

    const down2 = navigateComposerPromptHistory(state, 'down', down1.text)
    expect(down2.text).toBe('drafting…')
    expect(down2.state.index).toBe(-1)
  })

  it('does nothing on Down when not browsing', () => {
    const state = pushComposerPrompt(emptyComposerPromptHistory(), 'only')
    const result = navigateComposerPromptHistory(state, 'down', 'live')
    expect(result.handled).toBe(false)
    expect(result.text).toBe('live')
  })
})
