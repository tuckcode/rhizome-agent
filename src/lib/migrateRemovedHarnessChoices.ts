import { normalizeStoredAiAgent, type AiAgentId } from './aiAgents'
import type { Settings } from '../types'

/** CLI targets that are not chat engines. Leave them on disk. */
export const KEPT_EXTERNAL_AGENT_IDS = [
  'claude_code',
  'codex',
  'opencode',
  'antigravity',
  'kiro',
] as const

export type KeptExternalAgentId = (typeof KEPT_EXTERNAL_AGENT_IDS)[number]

const KEPT_EXTERNAL_AGENT_ID_SET = new Set<string>(KEPT_EXTERNAL_AGENT_IDS)

function asToken(value: unknown): string {
  if (value == null) return ''
  try {
    return String(value).trim()
  } catch {
    return ''
  }
}

function agentIdFromToken(token: string): string {
  const lower = token.toLowerCase()
  return lower.startsWith('agent:') ? lower.slice('agent:'.length) : lower
}

export function isKeptExternalAgentId(value: string | null | undefined): value is KeptExternalAgentId {
  if (!value) return false
  return KEPT_EXTERNAL_AGENT_ID_SET.has(agentIdFromToken(value))
}

/**
 * Map a leftover Prime/Hermes engine or agent choice to `native`.
 * Codex, Claude Code, and the other CLI targets stay. Garbage never throws.
 */
export function migrateRemovedHarnessChoice(value: unknown): string {
  const token = asToken(value)
  if (!token) return 'native'

  const lower = token.toLowerCase()
  if (lower === 'native' || lower === 'agent:native') return 'native'
  if (lower.startsWith('model:')) return token

  const agentId = agentIdFromToken(token)
  if (KEPT_EXTERNAL_AGENT_ID_SET.has(agentId)) {
    return lower.startsWith('agent:') ? `agent:${agentId}` : agentId
  }

  return 'native'
}

export function migrateStoredChatEngine(value: unknown): 'native' {
  void value
  return 'native'
}

/** Strip `agent:` and return a real agent id. Does not wipe Prime/Hermes. */
export function migrateStoredAiAgent(value: unknown): AiAgentId | null {
  const token = asToken(value)
  if (!token) return null
  return normalizeStoredAiAgent(agentIdFromToken(token))
}

export function migrateStoredAiTarget(value: unknown): string | null {
  const token = asToken(value)
  if (!token) return null
  if (token.toLowerCase().startsWith('model:')) return token
  const migrated = migrateRemovedHarnessChoice(token)
  if (migrated === 'native') return null
  return migrated
}

export function migrateRemovedHarnessSettings(settings: Settings): Settings {
  const conversations = (settings.ai_workspace_conversations ?? []).map((conversation) => ({
    ...conversation,
    target_id: migrateStoredAiTarget(conversation.target_id),
  }))

  return {
    ...settings,
    chat_engine: migrateStoredChatEngine(settings.chat_engine),
    default_ai_target: migrateStoredAiTarget(settings.default_ai_target),
    ai_workspace_conversations: conversations.length > 0
      ? conversations
      : settings.ai_workspace_conversations ?? null,
  }
}

function diskChatEngineIsAlreadyNative(value: Settings['chat_engine']): boolean {
  const token = asToken(value)
  return token === '' || token.toLowerCase() === 'native'
}

export function removedHarnessSettingsNeedPersist(raw: Settings, migrated: Settings): boolean {
  if (!diskChatEngineIsAlreadyNative(raw.chat_engine) && migrated.chat_engine === 'native') return true
  if ((raw.default_ai_target ?? null) !== (migrated.default_ai_target ?? null)) return true

  const rawConversations = raw.ai_workspace_conversations ?? []
  const nextConversations = migrated.ai_workspace_conversations ?? []
  if (rawConversations.length !== nextConversations.length) return true
  for (let index = 0; index < rawConversations.length; index += 1) {
    if ((rawConversations[index]?.target_id ?? null) !== (nextConversations[index]?.target_id ?? null)) {
      return true
    }
  }
  return false
}
