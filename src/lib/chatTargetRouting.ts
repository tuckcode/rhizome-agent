import type { ChatEngine } from './chatEngine'
import { chatEngineAllowsSendWithoutPrime } from './chatEngine'
import { isKeptExternalAgentId } from './migrateRemovedHarnessChoices'
import { aiTargetReady, type AiTarget } from './aiTargets'
import type { AiAgentsStatus } from './aiAgents'
import { isClaudeCodeSessionTarget } from './nativeSessionTarget'

function isNativeHarnessAgent(agent: string | null | undefined): boolean {
  return agent === 'prime' || agent === 'hermes'
}

/**
 * Prime and Hermes conversations always use the native engine.
 * Codex, Claude Code, and API models keep their own target.
 */
export function chatEngineForResolvedTarget(
  target: AiTarget | null | undefined,
  chatEngine: ChatEngine | undefined,
): ChatEngine | undefined {
  void chatEngine
  if (target?.kind === 'agent' && isNativeHarnessAgent(target.agent)) return 'native'
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

/**
 * `nativeTarget` is the open native chat's saved target. A chat saved as
 * Claude Code stays on the native stream whatever the composer shows, so
 * the engine is locked per chat (ADR-0191 step 5).
 */
export function usesNativeChatStream(
  target: AiTarget | null | undefined,
  agent: string | null | undefined,
  chatEngine: ChatEngine | undefined,
  nativeTarget?: string | null,
): boolean {
  void chatEngine
  if (isClaudeCodeSessionTarget(nativeTarget)) return true
  if (target?.kind === 'api_model') return false
  if (target?.kind === 'agent' && isKeptExternalAgentId(target.agent)) return false
  if (!target && isKeptExternalAgentId(agent)) return false
  return true
}
