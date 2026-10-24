import type { ChatEngine } from './chatEngine'
import type { AiAgentId } from './aiAgents'

export interface EffectiveChatEngineInput {
  requestedEngine: ChatEngine
  isPrimeTarget: boolean
  startedEngine: ChatEngine | null
}

export interface ChatEngineLock {
  engine: ChatEngine
  conversation: string
  target: string
}

/** ChatHome's conversation token — not Prime's session path, which can go null. */
export function newChatConversationId(): string {
  return crypto.randomUUID()
}

export function chatEngineLockTarget(
  isPrimeTarget: boolean,
  defaultAiAgent: AiAgentId,
): string {
  return isPrimeTarget ? 'prime' : defaultAiAgent
}

export function startedEngineFromLock(
  lock: ChatEngineLock | null,
  scope: Pick<ChatEngineLock, 'conversation' | 'target'>,
): ChatEngine | null {
  if (!lock) return null
  if (lock.conversation !== scope.conversation) return null
  if (lock.target !== scope.target) return null
  return lock.engine
}

/**
 * Which engine Chat should send on.
 *
 * Rhizome's own engine is the only chat engine (ADR-0189). A saved Prime
 * or Hermes choice and an already-open lock both resolve to native.
 * External CLI sends still go through `usesNativeChatStream`, which reads
 * the target rather than this value.
 */
export function resolveEffectiveChatEngine(): ChatEngine {
  return 'native'
}

/** Lock native once, as soon as this chat has no lock yet. */
export function shouldLockEffectiveChatEngine(input: EffectiveChatEngineInput): boolean {
  return input.startedEngine == null
}
