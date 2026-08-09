import { useCallback, useMemo, useState, useSyncExternalStore } from 'react'
import type { AiAgentId, AiAgentReadiness } from '../lib/aiAgents'
import type { AiTarget } from '../lib/aiTargets'
import type { AppLocale } from '../lib/i18n'
import { trackAiAgentPermissionModeChanged } from '../lib/productAnalytics'
import {
  aiAgentPermissionModeMarker,
  normalizeAiAgentPermissionMode,
  type AiAgentPermissionMode,
} from '../lib/aiAgentPermissionMode'
import { useCliAiAgent, type AgentFileCallbacks } from '../hooks/useCliAiAgent'
import type { VaultEntry } from '../types'
import {
  getVaultConfig,
  subscribeVaultConfig,
  updateVaultConfigField,
} from '../utils/vaultConfigStore'
import {
  type NoteListItem,
  type NoteReference,
} from '../utils/ai-context'
import { useAiPanelContextSnapshot } from './useAiPanelContextSnapshot'

interface UseAiPanelControllerArgs {
  vaultPath: string
  vaultPaths?: string[]
  defaultAiAgent: AiAgentId
  defaultAiTarget?: AiTarget
  defaultAiAgentReady: boolean
  defaultAiAgentReadiness?: AiAgentReadiness
  activeEntry?: VaultEntry | null
  activeNoteContent?: string | null
  entries?: VaultEntry[]
  openTabs?: VaultEntry[]
  noteList?: NoteListItem[]
  noteListFilter?: { type: string | null; query: string }
  locale?: AppLocale
  onOpenNote?: (path: string) => void
  onFileCreated?: (relativePath: string) => void
  onFileModified?: (relativePath: string) => void
  onVaultChanged?: () => void
  sessionId?: string
}

export interface AiPanelController {
  agent: ReturnType<typeof useCliAiAgent>
  input: string
  setInput: React.Dispatch<React.SetStateAction<string>>
  linkedEntries: ReturnType<typeof useAiPanelContextSnapshot>['linkedEntries']
  hasContext: boolean
  isActive: boolean
  permissionMode: AiAgentPermissionMode
  handleSend: (text: string, references: NoteReference[]) => void
  handleStop: () => void
  handleNavigateWikilink: (target: string) => void
  handlePermissionModeChange: (mode: AiAgentPermissionMode) => void
  handleNewChat: () => void
}

function resolveAgentReady(
  readiness: AiAgentReadiness | undefined,
  ready: boolean,
): boolean {
  return (readiness ?? (ready ? 'ready' : 'missing')) === 'ready'
}

function useVaultAiAgentPermissionMode(): AiAgentPermissionMode {
  const vaultConfig = useSyncExternalStore(subscribeVaultConfig, getVaultConfig)
  return normalizeAiAgentPermissionMode(vaultConfig.ai_agent_permission_mode)
}

function useVaultSessionAutoDistillEnabled(): boolean {
  const vaultConfig = useSyncExternalStore(subscribeVaultConfig, getVaultConfig)
  return vaultConfig.session_auto_distill_enabled === true
}

function useAgentFileCallbacks({
  onFileCreated,
  onFileModified,
  onVaultChanged,
}: Pick<
  UseAiPanelControllerArgs,
  'onFileCreated' | 'onFileModified' | 'onVaultChanged'
>): AgentFileCallbacks {
  return useMemo<AgentFileCallbacks>(() => ({
    onFileCreated,
    onFileModified,
    onVaultChanged,
  }), [onFileCreated, onFileModified, onVaultChanged])
}

function useAiPermissionModeHandler({
  agent,
  defaultAiAgent,
  isActive,
  locale,
  permissionMode,
}: {
  agent: ReturnType<typeof useCliAiAgent>
  defaultAiAgent: AiAgentId
  isActive: boolean
  locale: AppLocale
  permissionMode: AiAgentPermissionMode
}) {
  return useCallback((mode: AiAgentPermissionMode) => {
    const nextMode = normalizeAiAgentPermissionMode(mode)
    if (isActive || nextMode === permissionMode) return

    updateVaultConfigField('ai_agent_permission_mode', nextMode)
    trackAiAgentPermissionModeChanged(defaultAiAgent, nextMode)
    agent.addLocalMarker(aiAgentPermissionModeMarker(nextMode, locale))
  }, [agent, defaultAiAgent, isActive, locale, permissionMode])
}

function usePanelAgent({
  vaultPath,
  vaultPaths,
  contextPrompt,
  defaultAiAgent,
  defaultAiTarget,
  defaultAiAgentReady,
  defaultAiAgentReadiness,
  locale,
  onFileCreated,
  onFileModified,
  onVaultChanged,
  sessionId,
}: Pick<
  UseAiPanelControllerArgs,
  | 'vaultPath'
  | 'vaultPaths'
  | 'defaultAiAgent'
  | 'defaultAiTarget'
  | 'defaultAiAgentReady'
  | 'defaultAiAgentReadiness'
  | 'locale'
  | 'onFileCreated'
  | 'onFileModified'
  | 'onVaultChanged'
  | 'sessionId'
> & { contextPrompt?: string }) {
  const fileCallbacks = useAgentFileCallbacks({ onFileCreated, onFileModified, onVaultChanged })
  const permissionMode = useVaultAiAgentPermissionMode()
  const sessionAutoDistillEnabled = useVaultSessionAutoDistillEnabled()
  const agent = useCliAiAgent(vaultPath, vaultPaths, contextPrompt, fileCallbacks, {
    agent: defaultAiAgent,
    target: defaultAiTarget,
    locale,
    agentReady: resolveAgentReady(defaultAiAgentReadiness, defaultAiAgentReady),
    permissionMode,
    sessionId,
    sessionAutoDistillEnabled,
  })
  return { agent, permissionMode }
}

export function useAiPanelController({
  vaultPath,
  vaultPaths,
  defaultAiAgent,
  defaultAiTarget,
  defaultAiAgentReady,
  defaultAiAgentReadiness,
  activeEntry,
  activeNoteContent,
  entries,
  openTabs,
  noteList,
  noteListFilter,
  locale = 'en',
  onOpenNote,
  onFileCreated,
  onFileModified,
  onVaultChanged,
  sessionId,
}: UseAiPanelControllerArgs): AiPanelController {
  const [input, setInput] = useState('')
  const { linkedEntries, contextPrompt } = useAiPanelContextSnapshot({
    activeEntry,
    activeNoteContent,
    entries,
    input,
    openTabs,
    noteList,
    noteListFilter,
  })

  const { agent, permissionMode } = usePanelAgent({ vaultPath, vaultPaths, contextPrompt, defaultAiAgent, defaultAiTarget, defaultAiAgentReady, defaultAiAgentReadiness, locale, onFileCreated, onFileModified, onVaultChanged, sessionId })
  const isActive = agent.status === 'thinking' || agent.status === 'tool-executing'

  const handleSend = useCallback((text: string, references: NoteReference[]) => {
    if (!text.trim() || isActive) return
    agent.sendMessage(text, references)
    setInput('')
  }, [agent, isActive])

  const handleStop = useCallback(() => {
    if (!isActive) return
    agent.stopMessage()
  }, [agent, isActive])

  const handleNavigateWikilink = useCallback((target: string) => {
    onOpenNote?.(target)
  }, [onOpenNote])

  const handlePermissionModeChange = useAiPermissionModeHandler({ agent, defaultAiAgent, isActive, locale, permissionMode })

  const handleNewChat = useCallback(() => {
    agent.clearConversation()
    setInput('')
    // Prime long-lived host: reset RPC session so multi-turn context does not leak.
    if (defaultAiAgent === 'prime') {
      void import('@tauri-apps/api/core')
        .then(({ invoke }) => invoke<string>('prime_session_new_session'))
        .catch(() => {
          // Host may not be running yet; next prompt will spawn fresh enough.
        })
    }
  }, [agent, defaultAiAgent])

  return {
    agent,
    input,
    setInput,
    linkedEntries,
    hasContext: !!activeEntry,
    isActive,
    permissionMode,
    handleSend,
    handleStop,
    handleNavigateWikilink,
    handlePermissionModeChange,
    handleNewChat,
  }
}
