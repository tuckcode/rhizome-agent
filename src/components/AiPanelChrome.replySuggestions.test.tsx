import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AiPanelComposer } from './AiPanelChrome'
import * as replySuggestionsLib from '../lib/replySuggestions'

// Mock the suggestReply function so tests don't depend on parser implementation.
vi.mock('../lib/replySuggestions')

/**
 * Reply suggestions are pills the agent offers in lieu of a blank input field.
 * They are extracted from the agent's own closed questions, not guessed from state.
 *
 * When the agent asks "which would you prefer?", the options it lists become
 * clickable pills. Picking one puts that text in the composer without sending.
 *
 * Suggestions are only shown when the turn is idle (not streaming). While a
 * turn runs, the composer focuses on the current steering/stop decision.
 */

function renderComposer(
  props: Partial<React.ComponentProps<typeof AiPanelComposer>> = {},
) {
  return render(
    <AiPanelComposer
      entries={[]}
      agentLabel="Prime"
      agentReadiness="ready"
      input=""
      inputRef={{ current: null }}
      isActive={false}
      onChange={vi.fn()}
      onSend={vi.fn()}
      onStop={vi.fn()}
      {...props}
    />,
  )
}

describe('AiPanelComposer reply suggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /**
   * When the last agent message has no suggested options, the composer is a
   * blank box. No reserved space, no visual affordance beyond the ready state.
   */
  it('renders nothing when there are no suggestions', () => {
    vi.mocked(replySuggestionsLib.suggestReply).mockReturnValue(null)

    renderComposer({ lastAgentMessage: 'That is a great question.' })

    expect(screen.queryByTestId('composer-reply-suggestions')).toBeNull()
    expect(screen.queryByTestId('composer-reply-suggestion')).toBeNull()
  })

  /**
   * Options are minted by suggestReply(lastAgentMessage). Each pill reads its
   * option.label, sits above the input, and is clickable while idle.
   */
  it('renders pills when the agent suggests options', () => {
    const onChange = vi.fn()

    vi.mocked(replySuggestionsLib.suggestReply).mockReturnValue({
      kind: 'options',
      options: [
        { label: 'Run the tests', text: 'run the tests' },
        { label: 'Skip them for now', text: 'skip them for now' },
      ],
    })

    renderComposer({
      lastAgentMessage:
        'Would you prefer to (a) run the tests, or (b) skip them for now?',
      onChange,
    })

    const pills = screen.getAllByTestId('composer-reply-suggestion')
    expect(pills).toHaveLength(2)
    expect(pills[0]).toHaveTextContent('Run the tests')
    expect(pills[1]).toHaveTextContent('Skip them for now')

    // Clicking a pill puts its text in the input.
    fireEvent.click(pills[0])
    expect(onChange).toHaveBeenCalledWith('run the tests')
  })

  /**
   * While a turn is streaming, the composer focuses on steering or stopping the
   * response. Pills would only add noise and distraction at that moment.
   */
  it('does not render pills while a turn is active (streaming)', () => {
    vi.mocked(replySuggestionsLib.suggestReply).mockReturnValue({
      kind: 'options',
      options: [
        { label: 'Run the tests', text: 'run the tests' },
        { label: 'Skip them for now', text: 'skip them for now' },
      ],
    })

    renderComposer({
      isActive: true,
      lastAgentMessage:
        'Would you prefer to (a) run the tests, or (b) skip them for now?',
    })

    expect(screen.queryByTestId('composer-reply-suggestions')).toBeNull()
    expect(screen.queryByTestId('composer-reply-suggestion')).toBeNull()
  })

  /**
   * The suggestion row sits beside the queued follow-ups and attachments,
   * above the input box.
   */
  it('positions the suggestion row before the input', () => {
    vi.mocked(replySuggestionsLib.suggestReply).mockReturnValue({
      kind: 'options',
      options: [
        { label: 'Push to origin', text: 'push to origin' },
        { label: 'Review first', text: 'review first' },
      ],
    })

    renderComposer({
      lastAgentMessage:
        'Ready to push to origin, or do you want to review first?',
    })

    const container = screen.getByTestId('composer-reply-suggestions').parentElement
    const children = Array.from(container?.children ?? [])
    const suggestionsIndex = children.findIndex(
      (child) => child.getAttribute('data-testid') === 'composer-reply-suggestions',
    )
    const inputContainerIndex = children.findIndex((child) =>
      child.querySelector('[data-testid="agent-input"]'),
    )

    expect(suggestionsIndex).toBeGreaterThanOrEqual(0)
    expect(inputContainerIndex).toBeGreaterThanOrEqual(0)
    expect(suggestionsIndex).toBeLessThan(inputContainerIndex)
  })

  /**
   * Clicking a pill does not send the message. The text appears in the
   * composer and the person still presses Send.
   */
  it('does not send when a pill is clicked', () => {
    const onSend = vi.fn()

    vi.mocked(replySuggestionsLib.suggestReply).mockReturnValue({
      kind: 'options',
      options: [
        { label: 'Continue the work', text: 'continue the work' },
        { label: 'Move on to something else', text: 'move on to something else' },
      ],
    })

    renderComposer({
      lastAgentMessage: 'Continue the work, or move on to something else?',
      onSend,
    })

    const pill = screen.getByRole('button', { name: 'Continue the work' })
    fireEvent.click(pill)

    expect(onSend).not.toHaveBeenCalled()
  })

  /**
   * When the agent's message contains neither options nor an obvious completion,
   * suggest nothing. The honest "I don't know" is better than a weak guess.
   */
  it('renders nothing for open-ended agent messages', () => {
    vi.mocked(replySuggestionsLib.suggestReply).mockReturnValue(null)

    renderComposer({
      lastAgentMessage:
        'I have made the changes. Here is what I did: 1. Updated the file. 2. Ran tests.',
    })

    expect(screen.queryByTestId('composer-reply-suggestions')).toBeNull()
  })
})
