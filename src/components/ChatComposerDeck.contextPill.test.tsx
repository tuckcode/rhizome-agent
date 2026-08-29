import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ChatComposerDeck } from './ChatComposerDeck'
import { TooltipProvider } from '@/components/ui/tooltip'

vi.mock('../lib/productAnalytics', () => ({
  trackComposerPillOpened: vi.fn(),
}))
vi.mock('./PrimeModelPicker', () => ({ PrimeModelPicker: () => null }))
vi.mock('./PrimeThinkingToggle', () => ({ PrimeThinkingToggle: () => null }))

/**
 * #38: a pill that looks like a control and does nothing reads as a broken
 * app, because the rest of the shell teaches that a pill is a dropdown.
 *
 * The context pill shipped as a static chip earlier today — the same defect
 * the issue is about, reintroduced by the feature that needed the pill.
 */
function renderDeck(props: Partial<Parameters<typeof ChatComposerDeck>[0]> = {}) {
  const onCloseContext = vi.fn()
  render(
    <TooltipProvider>
      <ChatComposerDeck locale="en" onCloseContext={onCloseContext} {...props} />
    </TooltipProvider>,
  )
  return { onCloseContext }
}

// Radix opens on pointerdown, not click.
function openPill() {
  fireEvent.pointerDown(
    screen.getByTestId('composer-context-pill'),
    new PointerEvent('pointerdown', { bubbles: true, button: 0 }),
  )
}

describe('ChatComposerDeck — the context pill', () => {
  it('is absent when the agent has no note', () => {
    renderDeck()
    expect(screen.queryByTestId('composer-context-pill')).not.toBeInTheDocument()
  })

  it('names the note the agent can see', () => {
    renderDeck({ contextLabel: 'memory-loop.md' })
    expect(screen.getByTestId('composer-context-pill')).toHaveTextContent('memory-loop.md')
  })

  /** The whole point of #38: it opens, like every other pill in this row. */
  it('opens a menu that says what the pill means', () => {
    renderDeck({ contextLabel: 'memory-loop.md' })
    openPill()
    expect(screen.getByText('The agent can read this note')).toBeInTheDocument()
  })

  it('stops sending the note when asked', () => {
    const { onCloseContext } = renderDeck({ contextLabel: 'memory-loop.md' })
    openPill()
    fireEvent.click(screen.getByTestId('composer-context-clear'))
    expect(onCloseContext).toHaveBeenCalledTimes(1)
  })

  /** No way to act on it, no affordance suggesting there is. */
  it('stays a plain label when nothing can be done about it', () => {
    render(
      <TooltipProvider>
        <ChatComposerDeck locale="en" contextLabel="memory-loop.md" />
      </TooltipProvider>,
    )
    expect(screen.queryByTestId('composer-context-pill')).not.toBeInTheDocument()
    expect(screen.getByText(/memory-loop\.md/)).toBeInTheDocument()
  })
})
