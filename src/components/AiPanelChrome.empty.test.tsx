import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
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

    expect(screen.getByRole('heading', { name: 'Ask Rhizome' })).toBeInTheDocument()
    expect(screen.getByText(/Rhizome can research this repo/)).toBeInTheDocument()
    expect(screen.queryByTestId('ai-panel-transcript-loading')).toBeNull()
  })

  it('centers the empty state and prefills the composer from a starter', () => {
    const onPrefill = vi.fn()
    window.addEventListener('rhizome:ai-composer-prefill', onPrefill)
    render(<AiPanelMessageHistory {...historyProps()} />)

    const empty = screen.getByTestId('ai-panel-empty-state')
    expect(empty.className).toMatch(/items-center/)
    expect(empty.className).toMatch(/justify-center/)
    expect(empty.className).toMatch(/min-h-full|flex-1/)
    expect(screen.getAllByTestId('chat-empty-starter').every((button) => (
      button.getAttribute('class')?.includes('border')
      && !button.getAttribute('class')?.includes('bg-primary')
    ))).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Explain this repo' }))
    fireEvent.click(screen.getByRole('button', { name: 'Find and fix a bug' }))
    fireEvent.click(screen.getByRole('button', { name: 'Write tests for a file' }))
    expect(onPrefill.mock.calls.map((call) => (call[0] as CustomEvent<{ text: string }>).detail.text)).toEqual([
      'Explain this repo',
      'Find and fix a bug',
      'Write tests for a file',
    ])
    window.removeEventListener('rhizome:ai-composer-prefill', onPrefill)
  })

  it('shows a loading state while a picked session transcript is still loading', () => {
    render(<AiPanelMessageHistory {...historyProps({ transcriptState: 'loading' })} />)

    expect(screen.getByTestId('ai-panel-transcript-loading')).toHaveTextContent('Loading conversation')
    expect(screen.queryByText('Ask Rhizome')).toBeNull()
  })

  it('does not show the new-chat empty state over a selected session that loaded empty', () => {
    render(<AiPanelMessageHistory {...historyProps({ transcriptState: 'ready' })} />)

    expect(screen.queryByText('Ask Rhizome')).toBeNull()
    expect(screen.getByTestId('ai-panel-transcript-empty-session')).toHaveTextContent(
      'This session has no messages',
    )
  })

  it('shows a load-failed state instead of the new-chat empty screen', () => {
    render(<AiPanelMessageHistory {...historyProps({ transcriptState: 'error' })} />)

    expect(screen.queryByText('Ask Rhizome')).toBeNull()
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
    expect(screen.queryByText('Ask Rhizome')).toBeNull()
    expect(screen.queryByTestId('ai-panel-transcript-loading')).toBeNull()
  })
})
