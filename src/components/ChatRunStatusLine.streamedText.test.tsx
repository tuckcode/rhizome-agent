import { act, render, screen } from '@testing-library/react'
import { useState, type Dispatch, type SetStateAction } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentStatus, AiAgentMessage } from '../lib/aiAgentConversation'
import { createStreamCallbacks } from '../lib/aiAgentStreamCallbacks'
import { ChatRunStatusLine } from './ChatRunStatusLine'

vi.mock('../lib/telemetry', () => ({ trackEvent: vi.fn() }))

type Callbacks = ReturnType<typeof createStreamCallbacks>

function NativeTextRun({ onReady }: { onReady: (callbacks: Callbacks) => void }) {
  const [messages, setMessages] = useState<AiAgentMessage[]>([
    { id: 'msg-1', userMessage: 'Tell me a story', actions: [], isStreaming: true },
  ])
  const [callbacks] = useState(() => createStreamCallbacks({
    agent: 'prime',
    messageId: 'msg-1',
    vaultPath: '/vault',
    setMessages: setMessages as Dispatch<SetStateAction<AiAgentMessage[]>>,
    setStatus: (() => {}) as Dispatch<SetStateAction<AgentStatus>>,
    abortRef: { current: { aborted: false } },
    responseAccRef: { current: '' },
    toolInputMapRef: { current: new Map() },
    fileCallbacksRef: { current: undefined },
  }))
  onReady(callbacks)
  return <ChatRunStatusLine messages={messages} isActive />
}

describe('ChatRunStatusLine with a text-only native reply', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('shows Writing and never goes quiet while text arrives every 3s for 36s', () => {
    let callbacks: Callbacks | null = null
    render(<NativeTextRun onReady={(next) => { callbacks = next }} />)
    const line = screen.getByTestId('chat-run-status-line')
    expect(line).toHaveAttribute('data-run-state', 'thinking')

    // Bubs's repro: a text_delta every 3s for 36s, no tool call.
    for (let elapsed = 3_000; elapsed <= 36_000; elapsed += 3_000) {
      act(() => { vi.advanceTimersByTime(3_000) })
      act(() => { callbacks?.onText(`word ${elapsed} `) })
      expect(line).toHaveAttribute('data-run-state', 'writing')
      expect(line).toHaveTextContent('Writing')
    }
    act(() => { vi.advanceTimersByTime(2_000) })
    expect(line).toHaveAttribute('data-run-state', 'writing')
    expect(line).not.toHaveTextContent('No response')
  })
})
