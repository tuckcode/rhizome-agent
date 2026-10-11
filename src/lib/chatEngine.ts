import type { Settings } from '../types'

/** Chat stays on Prime until Settings stores `native`. */
export type ChatEngine = 'prime' | 'native'

export function readChatEngine(value: string | null | undefined): ChatEngine {
  return value === 'native' ? 'native' : 'prime'
}

/**
 * Native chats use Rhizome's engine. A missing Prime install must not
 * block send. Prime-targeted chats still need Prime.
 */
export function chatEngineAllowsSendWithoutPrime(engine: ChatEngine | undefined): boolean {
  return engine === 'native'
}

export function chatEngineFromSettings(settings: Pick<Settings, 'chat_engine'> | null | undefined): ChatEngine {
  return readChatEngine(settings?.chat_engine)
}

/** Absent on disk means Prime. Only `native` is stored. */
export function chatEngineForSave(engine: ChatEngine): string | null {
  return engine === 'native' ? 'native' : null
}
