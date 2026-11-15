import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AiMessage } from '../components/AiMessage'
import { chatRunFailure, ENGINE_DID_NOT_START } from './chatRunStatus'
import { ChatRunStatusLine } from '../components/ChatRunStatusLine'
import { createStreamCallbacks } from './aiAgentStreamCallbacks'
import type { AiAgentMessage } from './aiAgentConversation'
import { workerStartFailureReason } from './primeWorkerStartError'

vi.mock('../components/MarkdownContent', () => ({
  MarkdownContent: ({ content }: { content: string }) => <div data-testid="markdown-content">{content}</div>,
}))

vi.mock('../utils/clipboardText', () => ({
  writeClipboardText: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../lib/productAnalytics', () => ({
  trackVaultRetrievalSourceOpened: vi.fn(),
  trackAiAgentResponseCompleted: vi.fn(),
  trackAiAgentResponseFailed: vi.fn(),
  trackVaultCredentialsHandled: vi.fn(),
}))

const REASON = 'could not read the vault folder'
const WORKER_FAILED = `worker-failed: ${REASON}`

function messageAfter(error: string): AiAgentMessage {
  let messages: AiAgentMessage[] = [{
    id: 'msg-1',
    userMessage: 'hello',
    actions: [],
    isStreaming: true,
  }]
  const callbacks = createStreamCallbacks({
    agent: 'prime',
    messageId: 'msg-1',
    vaultPath: '/vault',
    setMessages: (next) => {
      messages = typeof next === 'function' ? next(messages) : next
    },
    setStatus: () => {},
    abortRef: { current: { aborted: false } },
    responseAccRef: { current: '' },
    toolInputMapRef: { current: new Map() },
    fileCallbacksRef: { current: undefined },
  })
  callbacks.onError(error)
  callbacks.onDone()
  const message = messages[0]
  if (!message) throw new Error('expected the failed turn to stay in the transcript')
  return message
}

describe('primeWorkerStartError', () => {
  it('reads the reason only when the message starts with the worker-failed prefix', () => {
    expect(workerStartFailureReason(WORKER_FAILED)).toBe(REASON)
    expect(workerStartFailureReason(`Error: ${WORKER_FAILED}`)).toBe(REASON)
    expect(workerStartFailureReason('Prime agent turn timed out')).toBeNull()
    expect(workerStartFailureReason('worker-failed:')).toBeNull()
    expect(workerStartFailureReason('worker-failed:reason')).toBeNull()
  })

  it('says the engine did not start instead of the generic timeout or the host words', () => {
    const message = messageAfter(WORKER_FAILED)
    const reason = workerStartFailureReason(message.response ?? '')

    render(
      <>
        <ChatRunStatusLine messages={[]} isActive={false} failure={chatRunFailure(reason)} />
        <AiMessage
          userMessage={message.userMessage}
          actions={message.actions}
          response={message.response}
          isStreaming={message.isStreaming}
        />
      </>,
    )

    const status = screen.getByTestId('chat-run-status-line')
    expect(status).toHaveTextContent(ENGINE_DID_NOT_START)
    expect(status).not.toHaveTextContent(REASON)
    expect(status).not.toHaveTextContent('timed out')
    expect(status).not.toHaveTextContent('finished without returning a reply')
    expect(screen.getByTestId('markdown-content')).toHaveTextContent(ENGINE_DID_NOT_START)
    expect(screen.getByTestId('markdown-content')).not.toHaveTextContent(REASON)
    expect(screen.getByTestId('markdown-content')).not.toHaveTextContent('worker-failed:')
    expect(screen.getByTestId('markdown-content')).not.toHaveTextContent('timed out')
    expect(screen.getByTestId('markdown-content')).not.toHaveTextContent('finished without returning a reply')
  })
})
