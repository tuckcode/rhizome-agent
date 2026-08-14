import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ChatComposerDeck } from './ChatComposerDeck'

describe('ChatComposerDeck', () => {
  it('names the open note as context when Frame B has a split', () => {
    render(
      <ChatComposerDeck
        modelLabel="Grok 4.5"
        vaultLabel="Laputa"
        skillsLabel="rhizome-vault"
        contextLabel="memory-loop.md"
      />,
    )

    expect(screen.getByTestId('chat-composer-deck')).toHaveTextContent('ctx · memory-loop.md')
  })
})
