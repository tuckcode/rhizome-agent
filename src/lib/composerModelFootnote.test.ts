import { describe, expect, it } from 'vitest'
import { composerModelFootnote } from './composerModelFootnote'

describe('composerModelFootnote', () => {
  it('says a started chat keeps its model when the pick changes the default', () => {
    expect(composerModelFootnote('llama3.2', 'GPT-4o')).toBe(
      'New chats use this model. This chat stays on llama3.2.',
    )
  })

  it('says new chats use the model when this chat has no stored model', () => {
    expect(composerModelFootnote(null, 'GPT-4o')).toBe('New chats use this model.')
    expect(composerModelFootnote('GPT-4o', 'GPT-4o')).toBe('New chats use this model.')
  })
})
