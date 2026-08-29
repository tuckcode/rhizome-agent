import { useCallback, useEffect, useRef } from 'react'
import { trackEvent } from '../lib/telemetry'
import { SETTINGS_SECTION_IDS } from '../components/settingsSectionIds'
import {
  AI_WORKSPACE_DOCK_REQUESTED_EVENT,
  OPEN_AI_CHAT_EVENT,
} from '../utils/aiPromptBridge'

export const AGENT_CHAT_OPENED_SESSION_KEY = 'rhizome:agent-chat-opened-session'

interface UseAppAiWorkspaceBridgeOptions {
  aiWorkspaceWindow: boolean
  openAIChat: () => void
  /** Frame A — conversation owns the window. Launch goes here, not the side panel. */
  openChatHome: () => void
  openSettings: () => void
  setSettingsInitialSectionId: (sectionId: string | null) => void
  showAIChat: boolean
  /** Note windows / detached shells keep their own surface. */
  suppressDefaultOpen?: boolean
  /** Wait for the vault switcher to finish initial load so onSwitch cannot clobber ChatHome. */
  vaultReady?: boolean
}

interface AppAiWorkspaceBridge {
  effectiveShowAIChat: boolean
  handleOpenAiSettings: () => void
  handleOpenDockedAiWorkspace: () => void
}

function useOpenAiChatEvent(openAiWorkspace: (source: 'event') => void) {
  useEffect(() => {
    const handleOpenAiChat = () => {
      openAiWorkspace('event')
    }

    window.addEventListener(OPEN_AI_CHAT_EVENT, handleOpenAiChat)
    return () => window.removeEventListener(OPEN_AI_CHAT_EVENT, handleOpenAiChat)
  }, [openAiWorkspace])
}

function useDockRequestEvent(aiWorkspaceWindow: boolean, openAIChat: () => void) {
  useEffect(() => {
    if (aiWorkspaceWindow) return

    const handleDockRequest = () => {
      openAIChat()
      trackEvent('ai_workspace_docked', { source: 'window' })
    }

    window.addEventListener(AI_WORKSPACE_DOCK_REQUESTED_EVENT, handleDockRequest)

    return () => {
      window.removeEventListener(AI_WORKSPACE_DOCK_REQUESTED_EVENT, handleDockRequest)
    }
  }, [aiWorkspaceWindow, openAIChat])
}

/**
 * Agent product: Chat is the center canvas (ADR-0166). Launch no longer
 * switches to a Chat *destination*; the shell already mounts ChatHome.
 * Classic shell (`ff_shell_command_rail=false`) still uses this to replace
 * the notes window once per browser/app session.
 */
function useAgentDefaultOpenChat(
  aiWorkspaceWindow: boolean,
  showAIChat: boolean,
  openChatHome: () => void,
  suppressDefaultOpen = false,
  vaultReady = false,
) {
  const didTry = useRef(false)
  useEffect(() => {
    if (didTry.current) return
    if (!vaultReady) return
    if (aiWorkspaceWindow || showAIChat || suppressDefaultOpen) return
    try {
      if (sessionStorage.getItem(AGENT_CHAT_OPENED_SESSION_KEY) === '1') {
        didTry.current = true
        return
      }
      sessionStorage.setItem(AGENT_CHAT_OPENED_SESSION_KEY, '1')
    } catch {
      // private mode / denied storage — still open once this mount
    }
    didTry.current = true
    openChatHome()
    trackEvent('ai_workspace_open', { source: 'agent_default_chat_home' })
  }, [aiWorkspaceWindow, openChatHome, showAIChat, suppressDefaultOpen, vaultReady])
}

export function useAppAiWorkspaceBridge({
  aiWorkspaceWindow,
  openAIChat,
  openChatHome,
  openSettings,
  setSettingsInitialSectionId,
  showAIChat,
  suppressDefaultOpen = false,
  vaultReady = false,
}: UseAppAiWorkspaceBridgeOptions): AppAiWorkspaceBridge {
  useDockRequestEvent(aiWorkspaceWindow, openAIChat)
  useAgentDefaultOpenChat(
    aiWorkspaceWindow,
    showAIChat,
    openChatHome,
    suppressDefaultOpen,
    vaultReady,
  )

  const handleOpenAiSettings = useCallback(() => {
    setSettingsInitialSectionId(SETTINGS_SECTION_IDS.ai)
    openSettings()
  }, [openSettings, setSettingsInitialSectionId])

  const openAiWorkspace = useCallback(
    (source: 'event' | 'status_bar') => {
      trackEvent('ai_workspace_open', { source })
      openAIChat()
    },
    [openAIChat],
  )

  useOpenAiChatEvent(openAiWorkspace)

  const handleOpenDockedAiWorkspace = useCallback(() => {
    openAiWorkspace('status_bar')
  }, [openAiWorkspace])

  return {
    effectiveShowAIChat: showAIChat,
    handleOpenAiSettings,
    handleOpenDockedAiWorkspace,
  }
}
