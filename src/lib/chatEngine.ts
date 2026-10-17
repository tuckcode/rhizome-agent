import type { Settings } from '../types'

/** Chat runs on Rhizome's native loop until Settings stores `prime`. */
export type ChatEngine = 'prime' | 'native'

export function readChatEngine(value: string | null | undefined): ChatEngine {
  return value === 'prime' ? 'prime' : 'native'
}

/**
 * Only a resolved native chat skips the Prime install check.
 * A missing engine is not that resolution — callers that know the
 * setting pass `native` or `prime`. Omitting it keeps the agent
 * install check.
 */
export function chatEngineAllowsSendWithoutPrime(engine: ChatEngine | undefined): boolean {
  return engine === 'native'
}

export function chatEngineFromSettings(settings: Pick<Settings, 'chat_engine'> | null | undefined): ChatEngine {
  return readChatEngine(settings?.chat_engine)
}

/**
 * Null is the stored default (native), so a later default change still
 * reaches people who never picked an engine. `prime` is written only
 * when someone turns the switch off. An explicit `native` already on
 * disk still reads as native.
 */
export function chatEngineForSave(engine: ChatEngine): string | null {
  return engine === 'prime' ? 'prime' : null
}
