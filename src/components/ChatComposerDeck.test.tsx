import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ChatComposerDeck } from './ChatComposerDeck'

describe('ChatComposerDeck', () => {
  it('names the open note as context when Frame B has a split', () => {
    render(
      <ChatComposerDeck
        vaultLabel="Laputa"
        skillsLabel="rhizome-vault"
        contextLabel="memory-loop.md"
      />,
    )

    expect(screen.getByTestId('chat-composer-deck')).toHaveTextContent('ctx · memory-loop.md')
  })

  it('carries no model picker — the strip owns the model now (#9)', () => {
    // One place to read the model and one place to change it, and they are the
    // same place. A second picker here is what #9 removed; if one comes back,
    // the two can disagree about which model answered.
    render(<ChatComposerDeck vaultLabel="Laputa" skillsLabel="rhizome-vault" />)

    expect(screen.queryByTestId('prime-model-chip')).not.toBeInTheDocument()
    expect(screen.queryByTestId('prime-model-thinking-control')).not.toBeInTheDocument()
  })

  it('keeps vault and skills', () => {
    render(<ChatComposerDeck vaultLabel="Laputa" skillsLabel="rhizome-vault" />)

    const deck = screen.getByTestId('chat-composer-deck')
    expect(deck).toHaveTextContent('Laputa')
    expect(deck).toHaveTextContent('rhizome-vault')
  })
})
