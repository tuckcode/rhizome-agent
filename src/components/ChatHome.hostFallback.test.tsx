import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const invoked = vi.hoisted(() => ({
  calls: [] as Array<{ cmd: string; args?: Record<string, unknown> }>,
  running: false,
  problem: null as { code: string } | null,
}))

vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: (cmd: string, args?: Record<string, unknown>) => {
    invoked.calls.push({ cmd, args })
    if (cmd === 'get_prime_session_host_status') {
      return Promise.resolve({
        installed: false,
        version: null,
        running: invoked.running,
        sessionId: null,
        isStreaming: false,
        binaryPath: null,
        problem: invoked.problem,
      })
    }
    return Promise.resolve(null)
  },
}))

vi.mock('./AiPanel', () => ({
  AiPanel: () => <div data-testid="ai-panel-stub" />,
}))

vi.mock('../utils/loadChatNoteContent', () => ({
  loadChatNoteContent: vi.fn(async () => ''),
}))

import ChatHome from './ChatHome'
import { resetPrimeHostStatus } from '../hooks/usePrimeHostStatus'

describe('ChatHome host fallback (real Prime host hook)', () => {
  beforeEach(() => {
    invoked.calls = []
    invoked.running = false
    invoked.problem = { code: 'not_installed' }
    resetPrimeHostStatus()
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    })
  })

  it('opens on the native engine and does not poll Prime', async () => {
    render(
      <ChatHome
        locale="en"
        chatEngine="prime"
        defaultAiAgent="prime"
        defaultAiAgentReadiness="ready"
        defaultAiAgentReady
        vaultPath="/Users/jdoe/Documents/Laputa"
        vaultPaths={['/Users/jdoe/Documents/Laputa']}
        entries={[]}
        onExit={vi.fn()}
      />,
    )

    await waitFor(() => {
      expect(screen.getByTestId('chat-home')).toHaveAttribute('data-chat-engine', 'native')
    })
    expect(invoked.calls.some((call) => call.cmd === 'get_prime_session_host_status')).toBe(false)
  })
})
