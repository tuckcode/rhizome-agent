import type { Settings } from '../types'

/** Chat stays on Prime until Settings stores `native`. */
export type ChatEngine = 'prime' | 'native'

export function readChatEngine(value: string | null | undefined): ChatEngine {
  return value === 'native' ? 'native' : 'prime'
}

export function chatEngineFromSettings(settings: Pick<Settings, 'chat_engine'> | null | undefined): ChatEngine {
  return readChatEngine(settings?.chat_engine)
}

/** Absent on disk means Prime. Only `native` is stored. */
export function chatEngineForSave(engine: ChatEngine): string | null {
  return engine === 'native' ? 'native' : null
}
