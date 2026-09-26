import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AiPanelComposer, AiPanelMessageHistory } from './AiPanelChrome'

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ startDragging: vi.fn() }),
}))

/**
 * Native audit 2026-09-26: on a wide window the prompt, the reply and the
 * composer each used a different width. They now share one bounded reading
 * column, so the eye follows a single edge.
 */
describe('chat reading column', () => {
  it('puts the transcript inside the shared reading column', () => {
    Element.prototype.scrollIntoView = vi.fn()
    render(
      <AiPanelMessageHistory
        agentLabel="Prime"
        agentReadiness="ready"
        messages={[{ userMessage: 'hi', response: 'hello', actions: [] }]}
        isActive={false}
        hasContext={false}
      />,
    )
    const history = screen.getByTestId('ai-panel-message-history')
    expect(history.classList.contains('chat-transcript')).toBe(true)
    const column = history.querySelector('.chat-column')
    expect(column).not.toBeNull()
    expect(column?.textContent).toContain('hello')
  })

  it('puts the composer inside the same reading column', () => {
    render(
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
      />,
    )
    const send = screen.getByTestId('agent-send')
    expect(send.closest('.chat-column')).not.toBeNull()
  })

  it('advertises the keys on Send, not in a row of their own', () => {
    render(
      <AiPanelComposer
        entries={[]}
        agentLabel="Prime"
        agentReadiness="ready"
        input="hi"
        inputRef={{ current: null }}
        isActive={false}
        onChange={vi.fn()}
        onSend={vi.fn()}
        onStop={vi.fn()}
      />,
    )
    // handleSubmitKey sends on plain Enter without Shift. Advertising a Cmd
    // chord made users type multi-line prompts that sent themselves.
    const title = screen.getByTestId('agent-send').getAttribute('title') ?? ''
    expect(title).toContain('↵')
    expect(title).toContain('⇧↵')
    expect(title).not.toContain('⌘')
    expect(screen.getByTestId('agent-send')).toHaveAttribute('aria-label', 'Send message')
  })
})
