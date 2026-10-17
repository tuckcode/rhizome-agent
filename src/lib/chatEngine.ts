import type { Settings } from '../types'

/** Chat runs on Rhizome's native loop until Settings stores `prime`. */
export type ChatEngine = 'prime' | 'native'

export function readChatEngine(value: string | null | undefined): ChatEngine {
  return value === 'prime' ? 'prime' : 'native'
}

/**
 * Native chats, and a missing engine setting, use Rhizome's loop.
 * A missing Prime install must not block send. Prime-targeted chats
 * still need Prime.
 */
export function chatEngineAllowsSendWithoutPrime(engine: ChatEngine | undefined): boolean {
  return engine !== 'prime'
}

export function chatEngineFromSettings(settings: Pick<Settings, 'chat_engine'> | null | undefined): ChatEngine {
  return readChatEngine(settings?.chat_engine)
}

/** Absent on disk means native. Settings stores `native` or `prime`. */
export function chatEngineForSave(engine: ChatEngine): string {
  return engine
}
