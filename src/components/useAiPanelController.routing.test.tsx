import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAiPanelController } from './useAiPanelController'
import { streamAiAgent } from '../utils/streamAiAgent'
import { streamNativeChat } from '../utils/streamNativeChat'
import { getAgentDocsPath } from '../lib/agentDocsPath'
import { resetAiWorkspaceSessionStoreForTests } from '../lib/aiWorkspaceSessionStore'
import { resetNativeLiveSessions } from '../lib/nativeChatTranscript'
import type { AiTarget } from '../lib/aiTargets'

vi.mock('../utils/streamAiAgent', () => ({
  streamAiAgent: vi.fn(),
}))

vi.mock('../utils/streamNativeChat', () => ({
  streamNativeChat: vi.fn(),
}))

vi.mock('../utils/streamAiModel', () => ({
  streamAiModel: vi.fn(),
}))

vi.mock('../lib/agentDocsPath', () => ({
  getAgentDocsPath: vi.fn(),
}))

const mockStreamAiAgent = vi.mocked(streamAiAgent)
const mockStreamNativeChat = vi.mocked(streamNativeChat)
const mockGetAgentDocsPath = vi.mocked(getAgentDocsPath)

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
    <button type="button" onClick={() => controller.handleSend('Hello Claude', [])}>
      send
    </button>
  )
}

describe('useAiPanelController routing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAgentDocsPath.mockResolvedValue('/app/agent-docs')
    resetAiWorkspaceSessionStoreForTests()
    resetNativeLiveSessions()
    mockStreamAiAgent.mockResolvedValue(undefined)
    mockStreamNativeChat.mockResolvedValue(undefined)
  })

  it('sends Claude Code through the real controller and session, not the native engine', async () => {
    render(<Harness />)

    await act(async () => {
      screen.getByRole('button', { name: 'send' }).click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(mockStreamAiAgent).toHaveBeenCalledWith(expect.objectContaining({
      agent: 'claude_code',
    }))
    expect(mockStreamNativeChat).not.toHaveBeenCalled()
  })
})
