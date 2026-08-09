import { useMemo } from 'react'
import type { AiAgentId, AiAgentsStatus } from '../lib/aiAgents'
import type { VaultAiGuidanceStatus } from '../lib/vaultAiGuidance'

interface AppCommandDialogs {
  toggleAIChat: () => void
  openSettings: () => void
}

interface AppCommandAiPreferences {
  defaultAiAgent: AiAgentId
  setDefaultAiAgent: (agent: AiAgentId) => void
  cycleDefaultAiAgent: () => void
  defaultAiAgentLabel: string
}

interface AppCommandAiActions {
  aiFeaturesEnabled: boolean
  onToggleAIChat?: () => void
  onOpenAiAgents?: () => void
  aiAgentsStatus?: AiAgentsStatus
  vaultAiGuidanceStatus?: VaultAiGuidanceStatus
  onRestoreVaultAiGuidance?: () => void
  selectedAiAgent?: AiAgentId
  onSetDefaultAiAgent?: (agent: AiAgentId) => void
  onCycleDefaultAiAgent?: () => void
  selectedAiAgentLabel?: string
}

export function useAppCommandAiActions(
  aiFeaturesEnabled: boolean,
  dialogs: AppCommandDialogs,
  aiAgentsStatus: AiAgentsStatus,
  vaultAiGuidanceStatus: VaultAiGuidanceStatus,
  restoreVaultAiGuidanceCommand: (() => void) | undefined,
  aiAgentPreferences: AppCommandAiPreferences,
): AppCommandAiActions {
  return useMemo(() => {
    if (!aiFeaturesEnabled) return { aiFeaturesEnabled: false }

    return {
      aiFeaturesEnabled: true,
      onToggleAIChat: dialogs.toggleAIChat,
      onOpenAiAgents: dialogs.openSettings,
      aiAgentsStatus,
      vaultAiGuidanceStatus,
      onRestoreVaultAiGuidance: restoreVaultAiGuidanceCommand,
      selectedAiAgent: aiAgentPreferences.defaultAiAgent,
      onSetDefaultAiAgent: aiAgentPreferences.setDefaultAiAgent,
      onCycleDefaultAiAgent: aiAgentPreferences.cycleDefaultAiAgent,
      selectedAiAgentLabel: aiAgentPreferences.defaultAiAgentLabel,
    }
  }, [
    aiFeaturesEnabled,
    dialogs.toggleAIChat,
    dialogs.openSettings,
    aiAgentsStatus,
    vaultAiGuidanceStatus,
    restoreVaultAiGuidanceCommand,
    aiAgentPreferences.defaultAiAgent,
    aiAgentPreferences.setDefaultAiAgent,
    aiAgentPreferences.cycleDefaultAiAgent,
    aiAgentPreferences.defaultAiAgentLabel,
  ])
}
