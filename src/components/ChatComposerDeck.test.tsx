import { render, screen } from '@testing-library/react'
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
        skillsLabel="rhizome-vault"
        contextLabel="memory-loop.md"
      />,
    )

    expect(screen.getByTestId('chat-composer-deck')).toHaveTextContent('ctx · memory-loop.md')
  })

  it('puts model and thinking on the composer strip (#38 / #9 / #35)', () => {
    render(
      <ChatComposerDeck
        skillsLabel="rhizome-vault"
        model="Grok 4.5"
        thinkingLevel="off"
      />,
    )

    expect(screen.getByTestId('prime-model-chip')).toHaveTextContent('Grok 4.5')
    expect(screen.getByTestId('prime-thinking-toggle')).toHaveTextContent('Off')
  })

  it('names Prime and the skill as labels, not fake menus', () => {
    render(<ChatComposerDeck skillsLabel="rhizome-vault" />)

    expect(screen.getByTestId('composer-agent-pill').tagName).toBe('SPAN')
    expect(screen.getByTestId('composer-skills-pill').tagName).toBe('SPAN')
    expect(screen.getByTestId('composer-agent-pill')).toHaveTextContent('Prime')
    expect(screen.getByTestId('composer-skills-pill')).toHaveTextContent('rhizome-vault')
  })

  it('does not duplicate the vault switcher on the composer strip', () => {
    render(<ChatComposerDeck skillsLabel="rhizome-vault" />)

    expect(screen.queryByTestId('composer-vault-pill')).not.toBeInTheDocument()
    expect(screen.getByTestId('chat-composer-deck')).not.toHaveTextContent('Laputa')
    expect(screen.getByTestId('chat-composer-deck')).toHaveTextContent('rhizome-vault')
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
