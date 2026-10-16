import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ChatComposerDeck } from './ChatComposerDeck'

vi.mock('../lib/productAnalytics', () => ({
  trackComposerPillOpened: vi.fn(),
  trackPrimeModelChanged: vi.fn(),
  trackPrimeThinkingLevelChanged: vi.fn(),
  trackPrimeModelsFreeOnly: vi.fn(),
  trackRhizomeModelChanged: vi.fn(),
}))

describe('ChatComposerDeck', () => {
  it('names the open note as context when Frame B has a split', () => {
    render(
      <ChatComposerDeck
        contextLabel="memory-loop.md"
      />,
    )

    expect(screen.getByTestId('chat-composer-deck')).toHaveTextContent('ctx · memory-loop.md')
  })

  it('puts model and thinking on the composer strip (#38 / #9 / #35)', () => {
    render(
      <ChatComposerDeck
        model="Grok 4.5"
        thinkingLevel="off"
      />,
    )

    expect(screen.getByTestId('prime-model-chip')).toHaveTextContent('Grok 4.5')
    expect(screen.getByTestId('prime-thinking-toggle')).toHaveTextContent('Off')
    expect(screen.getByTestId('prime-model-chip').tagName).toBe('BUTTON')
    expect(screen.getByTestId('prime-thinking-toggle').tagName).toBe('BUTTON')
  })

  it('drops the Prime label chip and the skills chip (native audit 2026-09-26)', () => {
    // Chat is Prime-only and the header status says whether it is live. The
    // skill label lives in ChatComposerBar's Tools menu.
    render(<ChatComposerDeck />)

    expect(screen.queryByTestId('composer-agent-pill')).not.toBeInTheDocument()
    expect(screen.queryByTestId('composer-skills-pill')).not.toBeInTheDocument()
  })

  it('does not duplicate the vault switcher on the composer strip', () => {
    render(<ChatComposerDeck />)

    expect(screen.queryByTestId('composer-vault-pill')).not.toBeInTheDocument()
    expect(screen.getByTestId('chat-composer-deck')).not.toHaveTextContent('Laputa')
  })

  it('puts the Rhizome catalog chip on the composer row when Prime is not live', () => {
    render(
      <ChatComposerDeck
        catalog="rhizome"
        nativeTarget="open_ai/gpt-4.1-mini"
        onNativeTargetChange={vi.fn()}
      />,
    )

    const deck = screen.getByTestId('chat-composer-deck')
    const picker = screen.getByTestId('native-chat-model-picker')
    expect(deck.contains(picker)).toBe(true)
    expect(screen.getByTestId('native-chat-model-trigger')).toHaveClass('h-6')
    expect(screen.queryByTestId('prime-model-chip')).not.toBeInTheDocument()
    expect(screen.queryByTestId('prime-thinking-toggle')).not.toBeInTheDocument()
  })

  it('hosts the agent activity pill next to thinking', () => {
    render(
      <ChatComposerDeck
        thinkingLevel="off"
        activity={<span data-testid="status-agents-pill">Agents idle</span>}
      />,
    )

    const thinking = screen.getByTestId('prime-thinking-toggle')
    const agents = screen.getByTestId('status-agents-pill')
    expect(thinking.compareDocumentPosition(agents) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
