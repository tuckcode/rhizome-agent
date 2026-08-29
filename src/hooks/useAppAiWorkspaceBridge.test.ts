import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AGENT_CHAT_OPENED_SESSION_KEY,
  useAppAiWorkspaceBridge,
} from './useAppAiWorkspaceBridge'

function renderBridge(
  overrides: Partial<Parameters<typeof useAppAiWorkspaceBridge>[0]> = {},
) {
  const openAIChat = vi.fn()
  const openChatHome = vi.fn()
  renderHook(() =>
    useAppAiWorkspaceBridge({
      aiWorkspaceWindow: false,
      openAIChat,
      openChatHome,
      openSettings: vi.fn(),
      setSettingsInitialSectionId: vi.fn(),
      showAIChat: false,
      vaultReady: true,
      ...overrides,
    }),
  )
  return { openAIChat, openChatHome }
}

describe('useAppAiWorkspaceBridge default open', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('opens ChatHome on launch, not the side AI panel', () => {
    const { openAIChat, openChatHome } = renderBridge()

    expect(openChatHome).toHaveBeenCalledTimes(1)
    expect(openAIChat).not.toHaveBeenCalled()
  })

  it('does not reopen ChatHome later in the same session', () => {
    sessionStorage.setItem(AGENT_CHAT_OPENED_SESSION_KEY, '1')
    const { openChatHome } = renderBridge()

    expect(openChatHome).not.toHaveBeenCalled()
  })

  it('does not open ChatHome in a note window', () => {
    const { openChatHome } = renderBridge({ suppressDefaultOpen: true })

    expect(openChatHome).not.toHaveBeenCalled()
  })

  it('does not open ChatHome until the vault switcher has loaded', () => {
    const { openChatHome } = renderBridge({ vaultReady: false })

    expect(openChatHome).not.toHaveBeenCalled()
  })
})
