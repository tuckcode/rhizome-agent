import { useCallback, useEffect, useRef } from 'react'
import { trackEvent } from '../lib/telemetry'
import { SETTINGS_SECTION_IDS } from '../components/settingsSectionIds'
import {
  AI_WORKSPACE_DOCK_REQUESTED_EVENT,
  OPEN_AI_CHAT_EVENT,
} from '../utils/aiPromptBridge'

export const AGENT_CHAT_OPENED_SESSION_KEY = 'rhizome:agent-chat-opened-session'

interface UseAppAiWorkspaceBridgeOptions {
  aiFeaturesEnabled: boolean
  aiWorkspaceWindow: boolean
  closeAIChat: () => void
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

function useOpenAiChatEvent(aiFeaturesEnabled: boolean, openAiWorkspace: (source: 'event') => void) {
  useEffect(() => {
    const handleOpenAiChat = () => {
      if (!aiFeaturesEnabled) return
      openAiWorkspace('event')
    }

    window.addEventListener(OPEN_AI_CHAT_EVENT, handleOpenAiChat)
    return () => window.removeEventListener(OPEN_AI_CHAT_EVENT, handleOpenAiChat)
  }, [aiFeaturesEnabled, openAiWorkspace])
}

function useDockRequestEvent(aiFeaturesEnabled: boolean, aiWorkspaceWindow: boolean, openAIChat: () => void) {
  useEffect(() => {
    if (aiWorkspaceWindow) return

    const handleDockRequest = () => {
      if (!aiFeaturesEnabled) return
      openAIChat()
      trackEvent('ai_workspace_docked', { source: 'window' })
    }

    window.addEventListener(AI_WORKSPACE_DOCK_REQUESTED_EVENT, handleDockRequest)

    return () => {
      window.removeEventListener(AI_WORKSPACE_DOCK_REQUESTED_EVENT, handleDockRequest)
    }
  }, [aiFeaturesEnabled, aiWorkspaceWindow, openAIChat])
}

function useCloseDisabledAiWorkspace(aiFeaturesEnabled: boolean, closeAIChat: () => void, showAIChat: boolean) {
  useEffect(() => {
    if (!aiFeaturesEnabled && showAIChat) closeAIChat()
  }, [aiFeaturesEnabled, closeAIChat, showAIChat])
}

/**
 * Agent product: open Frame A (ChatHome) once per browser/app session
 * so launch is conversation-first. User can still leave via the rail.
 */
function useAgentDefaultOpenChat(
  aiFeaturesEnabled: boolean,
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
    if (!aiFeaturesEnabled || aiWorkspaceWindow || showAIChat || suppressDefaultOpen) return
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
  }, [aiFeaturesEnabled, aiWorkspaceWindow, openChatHome, showAIChat, suppressDefaultOpen, vaultReady])
}

export function useAppAiWorkspaceBridge({
  aiFeaturesEnabled,
  aiWorkspaceWindow,
  closeAIChat,
  openAIChat,
  openChatHome,
  openSettings,
  setSettingsInitialSectionId,
  showAIChat,
  suppressDefaultOpen = false,
  vaultReady = false,
}: UseAppAiWorkspaceBridgeOptions): AppAiWorkspaceBridge {
  useCloseDisabledAiWorkspace(aiFeaturesEnabled, closeAIChat, showAIChat)
  useDockRequestEvent(aiFeaturesEnabled, aiWorkspaceWindow, openAIChat)
  useAgentDefaultOpenChat(
    aiFeaturesEnabled,
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

  useOpenAiChatEvent(aiFeaturesEnabled, openAiWorkspace)

  const handleOpenDockedAiWorkspace = useCallback(() => {
    openAiWorkspace('status_bar')
  }, [openAiWorkspace])

  return {
    effectiveShowAIChat: aiFeaturesEnabled && showAIChat,
    handleOpenAiSettings,
    handleOpenDockedAiWorkspace,
  }
}
