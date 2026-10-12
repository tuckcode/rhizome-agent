import type { ChatEngine } from './chatEngine'

export interface EffectiveChatEngineInput {
  requestedEngine: ChatEngine
  isPrimeTarget: boolean
  hostKnown: boolean
  hostNotInstalled: boolean
  startedEngine: ChatEngine | null
}

/**
 * Which engine Chat should send on.
 *
 * Native fallback is only for Prime-targeted chats, and only after a real
 * host status says Prime is not installed. Unknown status stays on Prime.
 * An already-open chat keeps the engine it started on.
 */
export function resolveEffectiveChatEngine(input: EffectiveChatEngineInput): ChatEngine {
  if (input.startedEngine) return input.startedEngine
  if (input.requestedEngine === 'native') return 'native'
  if (!input.isPrimeTarget) return 'prime'
  if (!input.hostKnown) return 'prime'
  if (input.hostNotInstalled) return 'native'
  return 'prime'
}

/** Lock once Settings chose native, the chat is not Prime, or the host has spoken. */
export function shouldLockEffectiveChatEngine(input: EffectiveChatEngineInput): boolean {
  if (input.startedEngine) return false
  if (input.requestedEngine === 'native') return true
  if (!input.isPrimeTarget) return true
  return input.hostKnown
}
