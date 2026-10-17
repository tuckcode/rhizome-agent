import type { ChatEngine } from './chatEngine'
import { chatEngineAllowsSendWithoutPrime } from './chatEngine'
import { isKeptExternalAgentId } from './migrateRemovedHarnessChoices'
import { aiTargetReady, type AiTarget } from './aiTargets'
import type { AiAgentsStatus } from './aiAgents'

/**
 * The Chat engine applies to Prime (now native) conversations.
 * Codex, Claude Code, and API models keep their own target.
 */
export function chatEngineForResolvedTarget(
  target: AiTarget | null | undefined,
  chatEngine: ChatEngine | undefined,
): ChatEngine | undefined {
  if (target?.kind === 'agent' && target.agent === 'prime') return chatEngine
  return undefined
}

export function quickPromptTargetIsReady(
  target: AiTarget,
  chatEngine: ChatEngine | undefined,
  statuses: AiAgentsStatus,
): boolean {
  const resolvedEngine = chatEngineForResolvedTarget(target, chatEngine)
  if (chatEngineAllowsSendWithoutPrime(resolvedEngine)) return true
  return aiTargetReady(target, statuses)
}

export function usesNativeChatStream(
  target: AiTarget | null | undefined,
  agent: string | null | undefined,
  chatEngine: ChatEngine | undefined,
): boolean {
  if (target?.kind === 'api_model') return false
  if (target?.kind === 'agent' && isKeptExternalAgentId(target.agent)) return false
  if (!target && isKeptExternalAgentId(agent)) return false
  return chatEngine === 'native'
}
