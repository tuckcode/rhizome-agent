import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { AiPanelMessageHistory } from '../components/AiPanelChrome'
import { createStreamCallbacks } from './aiAgentStreamCallbacks'
import { conversationToNativeEvents, nativeEventsToConversation } from './nativeChatTranscript'
import { applyNativeEvent } from '../utils/streamNativeChat'
import type { AiAgentMessage, AgentStatus } from './aiAgentConversation'

vi.mock('../components/MarkdownContent', () => ({
  MarkdownContent: ({ content }: { content: string }) => <div>{content}</div>,
}))

describe('native capped turns', () => {
  it('ends a live stream as paused, preserving tool-only output without a success placeholder', () => {
    let messages: AiAgentMessage[] = [{ id: 'capped', userMessage: 'Work', actions: [], isStreaming: true }]
    let status: AgentStatus = 'thinking'
    const callbacks = createStreamCallbacks({
      agent: 'prime', messageId: 'capped', vaultPath: '/vault',
      setMessages: (next) => { messages = typeof next === 'function' ? next(messages) : next },
      setStatus: (next) => { status = typeof next === 'function' ? next(status) : next },
      abortRef: { current: { aborted: false } }, responseAccRef: { current: '' },
      toolInputMapRef: { current: new Map() }, fileCallbacksRef: { current: undefined },
    })
    expect(applyNativeEvent({ kind: 'turn_capped', steps: 10, max_steps: 10 }, callbacks)).toBe(true)
    callbacks.onDone()
    expect(status).toBe('idle')
    expect(messages[0]).toMatchObject({ capped: { steps: 10, max_steps: 10 }, isStreaming: false })
    expect(messages[0].response ?? '').toBe('')
  })

  it('preserves capped boundaries through replay and fork serialization', () => {
    const capped = { steps: 10, max_steps: 10 }
    const events = [{ User: { text: 'Work' } }, { Assistant: { text: 'Partial' } }, { TurnCapped: capped }]
    const messages = nativeEventsToConversation(events)
    expect(messages[0]).toMatchObject({ response: 'Partial', capped, isStreaming: false })
    expect(conversationToNativeEvents(messages)).toEqual(events)
  })

  it('wires the visible Continue count to the selected message and disables it during a turn', () => {
    const onContinueMessage = vi.fn()
    const props = {
      agentLabel: 'Rhizome', agentReadiness: 'ready' as const, hasContext: false,
      messages: [{ id: 'capped', userMessage: 'Work', actions: [], capped: { steps: 12, max_steps: 50 } }],
      onContinueMessage,
    }
    const view = render(<AiPanelMessageHistory {...props} isActive={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Continue (12/50)' }))
    expect(onContinueMessage).toHaveBeenCalledExactlyOnceWith('capped')
    view.rerender(<AiPanelMessageHistory {...props} isActive />)
    expect(screen.getByRole('button', { name: 'Continue (12/50)' })).toBeDisabled()
    view.rerender(<AiPanelMessageHistory {...props} messages={[...props.messages, { id: 'rejected', userMessage: '', actions: [], localMarker: "Continue couldn't start" }]} isActive={false} />)
    expect(screen.getByRole('button', { name: 'Continue (12/50)' })).toBeEnabled()
  })
})
