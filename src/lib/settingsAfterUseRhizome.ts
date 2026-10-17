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
  const stored = settings.ai_workspace_conversations ?? []
  const conversations = stored.map((conversation) => (
    activeConversationId && conversation.id === activeConversationId
      ? { ...conversation, target_id: rhizomeTargetId }
      : conversation
  ))

  return {
    ...settings,
    default_ai_target: rhizomeTargetId,
    ai_workspace_conversations: conversations.length > 0
      ? conversations
      : settings.ai_workspace_conversations,
  }
}
