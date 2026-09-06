import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AiPanelComposer } from './AiPanelChrome'

/**
 * Steering is the difference between chatting with an agent and submitting a
 * job to it. Before this, the composer was fully disabled for the whole turn
 * (`composerDisabled = isActive || …`), so the only interrupt was Stop — which
 * throws the turn's work away.
 *
 * The contract: while a turn runs, typed text steers it and empty input stops
 * it, and the button says which. Without an `onSteer` handler the composer
 * behaves exactly as it did before, so non-Prime agents are unaffected.
 */
function renderComposer(props: Partial<React.ComponentProps<typeof AiPanelComposer>> = {}) {
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

describe('AiPanelComposer steering', () => {
  it('offers Steer while a turn is running and the user has typed something', () => {
    renderComposer({ isActive: true, input: 'focus on error handling', onSteer: vi.fn() })

    expect(screen.getByRole('button', { name: 'Steer response' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Stop response' })).toBeNull()
  })

  it('offers Stop while running with an empty composer', () => {
    renderComposer({ isActive: true, input: '', onSteer: vi.fn() })

    expect(screen.getByRole('button', { name: 'Stop response' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Steer response' })).toBeNull()
  })

  /** Whitespace is not a steering instruction. */
  it('treats a whitespace-only composer as empty', () => {
    renderComposer({ isActive: true, input: '   ', onSteer: vi.fn() })

    expect(screen.getByRole('button', { name: 'Stop response' })).toBeTruthy()
  })

  /**
   * Computer-use and paste can fill the contenteditable without firing `input`,
   * so React's draft stays empty and the chrome shows Stop. Click must still
   * steer what is on screen — otherwise mid-turn queue probes die as "Stopped."
   */
  it('steers DOM text when Stop is showing because the React draft is stale', () => {
    const onSteer = vi.fn()
    const onStop = vi.fn()
    const inputRef: React.RefObject<HTMLDivElement | null> = { current: null }

    renderComposer({
      isActive: true,
      input: '',
      inputRef,
      onSteer,
      onStop,
    })

    const editor = screen.getByTestId('agent-input')
    editor.textContent = 'MIDTURN_QUEUE_PROBE'

    screen.getByRole('button', { name: 'Stop response' }).click()

    expect(onSteer).toHaveBeenCalledWith('MIDTURN_QUEUE_PROBE', [])
    expect(onStop).not.toHaveBeenCalled()
  })

  /** Agents without steering support must keep the old locked behaviour rather
   *  than offering an action their backend cannot honour. */
  it('falls back to Stop-only when the agent cannot steer', () => {
    renderComposer({ isActive: true, input: 'redirect please' })

    expect(screen.getByRole('button', { name: 'Stop response' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Steer response' })).toBeNull()
  })

  it('still sends normally when no turn is running', () => {
    renderComposer({ isActive: false, input: 'hello', onSteer: vi.fn() })

    expect(screen.getByRole('button', { name: 'Send message' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Steer response' })).toBeNull()
  })

  it('renders a foot row under the composer when one is provided', () => {
    renderComposer({ foot: <div data-testid="chat-composer-foot">Working · last tool get_note</div> })

    expect(screen.getByTestId('chat-composer-foot')).toHaveTextContent(
      'Working · last tool get_note',
    )
  })

  it('puts the control deck above the input', () => {
    renderComposer({
      controls: <div data-testid="chat-composer-deck">Prime</div>,
    })

    const deck = screen.getByTestId('chat-composer-deck')
    const input = screen.getByTestId('agent-input')
    expect(deck.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
