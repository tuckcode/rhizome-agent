import type { Settings } from '../types'

/**
 * Persist "Use Rhizome instead" to the chat target fields.
 * Leaves `default_ai_agent` alone so distill, inbox, and jobs stay on Prime.
 */
export function settingsAfterUseRhizome(
  settings: Settings,
  rhizomeTargetId: string,
  activeConversationId: string | null | undefined,
): Settings {
  const stored = [...(settings.ai_workspace_conversations ?? [])]
  if (activeConversationId) {
    const index = stored.findIndex((conversation) => conversation.id === activeConversationId)
    if (index >= 0) {
      stored[index] = { ...stored[index], target_id: rhizomeTargetId }
    } else {
      stored.push({
        archived: false,
        id: activeConversationId,
        target_id: rhizomeTargetId,
        title: 'AI Chat',
      })
    }
  }

  return {
    ...settings,
    default_ai_target: rhizomeTargetId,
    ai_workspace_conversations: stored.length > 0
      ? stored
      : settings.ai_workspace_conversations,
  }
}
