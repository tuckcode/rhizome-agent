import type { Settings } from '../types'

/** Prime remains only for engine internals that this PR does not delete. */
export type ChatEngine = 'prime' | 'native'

/** Settings no longer store an engine choice. Every leftover value is native. */
export function readChatEngine(value: string | null | undefined): ChatEngine {
  void value
  return 'native'
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

/** Native is the only Chat engine. Write that value, not an empty default. */
export function chatEngineForSave(engine: ChatEngine): string | null {
  void engine
  return 'native'
}
