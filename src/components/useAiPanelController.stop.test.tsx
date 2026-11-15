import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAiPanelController } from './useAiPanelController'
import { streamAiAgent } from '../utils/streamAiAgent'
import { getAgentDocsPath } from '../lib/agentDocsPath'
import { stopAgentMessage } from '../lib/aiAgentSession'
import { resetAiWorkspaceSessionStoreForTests } from '../lib/aiWorkspaceSessionStore'
import { resetNativeLiveSessions } from '../lib/nativeChatTranscript'
import type { AiTarget } from '../lib/aiTargets'

vi.mock('../utils/streamAiAgent', () => ({ streamAiAgent: vi.fn() }))
vi.mock('../utils/streamNativeChat', () => ({ streamNativeChat: vi.fn() }))
vi.mock('../utils/streamAiModel', () => ({ streamAiModel: vi.fn() }))
vi.mock('../lib/agentDocsPath', () => ({ getAgentDocsPath: vi.fn() }))
vi.mock('../lib/aiAgentSession', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/aiAgentSession')>()
  return { ...actual, stopAgentMessage: vi.fn(actual.stopAgentMessage) }
})

const claudeTarget: AiTarget = {
  kind: 'agent',
  agent: 'claude_code',
  id: 'agent:claude_code',
  label: 'Claude Code',
  shortLabel: 'Claude',
}

function Harness() {
  const controller = useAiPanelController({
    vaultPath: '/vault',
    vaultPaths: ['/vault'],
    defaultAiAgent: 'claude_code',
    defaultAiTarget: claudeTarget,
    defaultAiAgentReady: true,
    defaultAiAgentReadiness: 'ready',
    chatEngine: 'native',
    nativeTarget: 'open_ai/gpt-4.1-mini',
  })
  return (
    <>
      <button type="button" onClick={() => controller.handleSend('Run the tests', [])}>send</button>
      <button
        type="button"
        onClick={() => {
          // The Stop button and Cmd+Period in the same render.
          controller.handleStop()
          controller.handleStop()
        }}
      >
        stop twice
      </button>
      <span data-testid="active">{String(controller.isActive)}</span>
    </>
  )
}

describe('useAiPanelController stop', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetAiWorkspaceSessionStoreForTests()
    resetNativeLiveSessions()
    vi.mocked(getAgentDocsPath).mockResolvedValue('/app/agent-docs')
    vi.mocked(streamAiAgent).mockImplementation(() => new Promise(() => {}))
  })

  it('stops a run once when two stops land before the next render', async () => {
    render(<Harness />)
    await act(async () => {
      screen.getByRole('button', { name: 'send' }).click()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(screen.getByTestId('active')).toHaveTextContent('true')

    act(() => {
      screen.getByRole('button', { name: 'stop twice' }).click()
    })

    expect(vi.mocked(stopAgentMessage)).toHaveBeenCalledTimes(1)
  })
})
