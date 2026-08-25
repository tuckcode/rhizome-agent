import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ChatComposerDeck } from './ChatComposerDeck'

vi.mock('../lib/productAnalytics', () => ({
  trackComposerPillOpened: vi.fn(),
  trackPrimeModelChanged: vi.fn(),
  trackPrimeThinkingLevelChanged: vi.fn(),
}))

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

  it('puts model and thinking on the composer strip (#38 / #9 / #35)', () => {
    render(
      <ChatComposerDeck
        vaultLabel="Laputa"
        skillsLabel="rhizome-vault"
        model="Grok 4.5"
        thinkingLevel="off"
      />,
    )

    expect(screen.getByTestId('prime-model-chip')).toHaveTextContent('Grok 4.5')
    expect(screen.getByTestId('prime-thinking-toggle')).toHaveTextContent('Off')
  })

  it('makes the agent, vault, and skills chips real buttons with carets (#38)', () => {
    render(<ChatComposerDeck vaultLabel="Laputa" skillsLabel="rhizome-vault" />)

    expect(screen.getByTestId('composer-agent-pill').tagName).toBe('BUTTON')
    expect(screen.getByTestId('composer-vault-pill').tagName).toBe('BUTTON')
    expect(screen.getByTestId('composer-skills-pill').tagName).toBe('BUTTON')
  })

  it('lists vaults and switches on pick', () => {
    const onSwitchVault = vi.fn()
    render(
      <ChatComposerDeck
        vaultLabel="Laputa"
        vaultPath="/Users/dtc/Documents/Laputa"
        vaults={[
          { label: 'Laputa', path: '/Users/dtc/Documents/Laputa' },
          { label: 'Work', path: '/Users/dtc/Documents/Work' },
        ]}
        onSwitchVault={onSwitchVault}
      />,
    )

    fireEvent.pointerDown(
      screen.getByTestId('composer-vault-pill'),
      new PointerEvent('pointerdown', { bubbles: true, button: 0 }),
    )
    fireEvent.click(screen.getByTestId('composer-vault-/Users/dtc/Documents/Work'))
    expect(onSwitchVault).toHaveBeenCalledWith('/Users/dtc/Documents/Work')
  })

  it('keeps vault and skills labels on the strip', () => {
    render(<ChatComposerDeck vaultLabel="Laputa" skillsLabel="rhizome-vault" />)

    const deck = screen.getByTestId('chat-composer-deck')
    expect(deck).toHaveTextContent('Laputa')
    expect(deck).toHaveTextContent('rhizome-vault')
  })
})
