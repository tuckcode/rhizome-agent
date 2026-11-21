import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AiPanelMessageHistory } from './AiPanelChrome'
import type { AiAgentMessage } from '../lib/aiAgentConversation'

function message(userMessage: string, response: string): AiAgentMessage {
  return { userMessage, response, actions: [] }
}

function historyProps(overrides: Partial<Parameters<typeof AiPanelMessageHistory>[0]> = {}) {
  return {
    agentLabel: 'Prime',
    agentReadiness: 'ready' as const,
    messages: [] as AiAgentMessage[],
    isActive: false,
    hasContext: false,
    ...overrides,
  }
}

describe('AiPanelMessageHistory empty vs selected-session states', () => {
  it('shows the new-chat empty state only for a genuine new chat', () => {
    render(<AiPanelMessageHistory {...historyProps()} />)

    expect(screen.getByRole('heading', { name: 'What are we working on?' })).toBeInTheDocument()
    expect(screen.getByText(/Rhizome can research this repo/)).toBeInTheDocument()
    expect(screen.queryByTestId('ai-panel-transcript-loading')).toBeNull()
  })

  it('puts the brand and the headline directly above the composer', () => {
    render(<AiPanelMessageHistory {...historyProps()} />)

    const hero = screen.getByTestId('ai-panel-empty-state')
    expect(hero).toHaveAttribute('data-layout', 'hero')
    // An auto top margin sits the hero on the composer, and it shrinks to 0 in
    // a short window, so the top of the hero never goes out of reach.
    expect(screen.getByTestId('chat-home-wordmark').parentElement?.className).toMatch(/\bmt-auto\b/)
    expect(hero.className).not.toMatch(/justify-end|overflow-hidden/)
    expect(screen.getByTestId('chat-home-wordmark')).toHaveTextContent('rhizome')
    expect(hero.querySelector('svg')).not.toBeNull()
  })

  it('shows a loading state while a picked session transcript is still loading', () => {
    render(<AiPanelMessageHistory {...historyProps({ transcriptState: 'loading' })} />)

    expect(screen.getByTestId('ai-panel-transcript-loading')).toHaveTextContent('Loading conversation')
    expect(screen.queryByText('What are we working on?')).toBeNull()
  })

  it('does not show the new-chat empty state over a selected session that loaded empty', () => {
    render(<AiPanelMessageHistory {...historyProps({ transcriptState: 'ready' })} />)

    expect(screen.queryByText('What are we working on?')).toBeNull()
    expect(screen.getByTestId('ai-panel-transcript-empty-session')).toHaveTextContent(
      'This session has no messages',
    )
  })

  it('shows a load-failed state instead of the new-chat empty screen', () => {
    render(<AiPanelMessageHistory {...historyProps({ transcriptState: 'error' })} />)

    expect(screen.queryByText('What are we working on?')).toBeNull()
    expect(screen.getByTestId('ai-panel-transcript-error')).toHaveTextContent(
      'Could not load this conversation',
    )
  })

  it('never sits the empty state above an existing conversation', () => {
    render(
      <AiPanelMessageHistory
        {...historyProps({
          messages: [message('earlier', 'still here')],
          transcriptState: 'loading',
        })}
      />,
    )

    expect(screen.getByText('still here')).toBeInTheDocument()
    expect(screen.queryByText('What are we working on?')).toBeNull()
    expect(screen.queryByTestId('ai-panel-transcript-loading')).toBeNull()
  })
  it('shows a session notice in words, with no decorative icon', () => {
    render(<AiPanelMessageHistory {...historyProps({ transcriptState: 'ready' })} />)
    const notice = screen.getByTestId('ai-panel-transcript-empty-session')
    expect(notice.querySelector('svg')).toBeNull()
  })
})
