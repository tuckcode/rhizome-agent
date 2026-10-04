import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ChatComposerBar } from './ChatComposerBar'

vi.mock('../lib/productAnalytics', () => ({ trackComposerPillOpened: vi.fn() }))

/**
 * Native audit 2026-09-26: context, provider, model, reasoning, agents,
 * skills, Goal, Schedule, readiness and key hints stacked around the input
 * took about a quarter of a small window. Routine settings now share one
 * compact row under the input; context details open on request; only
 * active work gets inline status.
 */

function renderBar(props: Partial<Parameters<typeof ChatComposerBar>[0]> = {}) {
  render(
    <ChatComposerBar
      deck={<span data-testid="deck">model</span>}
      stats={{}}
      {...props}
    />,
  )
}

describe('ChatComposerBar', () => {
  it('is one row holding the deck, without the tools menu', () => {
    renderBar()
    const bar = screen.getByTestId('chat-composer-bar')
    expect(bar).toContainElement(screen.getByTestId('deck'))
    expect(screen.queryByTestId('composer-tools-menu')).not.toBeInTheDocument()
    expect(screen.queryByTestId('prime-goal-trigger')).not.toBeInTheDocument()
  })

  it('says nothing about status while idle', () => {
    renderBar()
    expect(screen.queryByTestId('chat-composer-foot')).not.toBeInTheDocument()
    expect(screen.getByTestId('chat-composer-bar')).not.toHaveTextContent('Idle')
  })

  it('names the running tool while a turn works', () => {
    renderBar({ working: true, lastToolName: 'get_note' })
    expect(screen.getByTestId('chat-composer-foot')).toHaveTextContent('Working · last tool get_note')
  })

  it('hides the context control until Prime reports usage', () => {
    renderBar()
    expect(screen.queryByTestId('prime-context-button')).not.toBeInTheDocument()
  })

  it('shows context as a percent and reveals the meter on request', () => {
    renderBar({ stats: { contextTokens: 2_000, contextWindow: 200_000 } })
    const button = screen.getByTestId('prime-context-button')
    expect(button).toHaveTextContent('1%')
    expect(screen.getByTestId('prime-context-ring')).toBeInTheDocument()
    expect(button).toHaveAttribute('data-pressure', 'ok')
    expect(screen.queryByTestId('prime-context-meter')).not.toBeInTheDocument()
    // Radix Popover opens on click.
    fireEvent.click(button)
    expect(screen.getByTestId('prime-context-meter')).toHaveTextContent('2.0k / 200.0k')
    expect(screen.getByTestId('prime-context-breakdown')).toHaveTextContent('Free')
    expect(screen.getByTestId('prime-context-breakdown')).toHaveTextContent('198.0k')
  })

  it('flags context pressure on the compact control', () => {
    renderBar({ stats: { contextTokens: 190_000, contextWindow: 200_000 } })
    expect(screen.getByTestId('prime-context-button')).toHaveAttribute('data-pressure', 'high')
  })
})
