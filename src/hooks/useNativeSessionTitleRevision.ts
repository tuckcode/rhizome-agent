import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { useEffect, useState } from 'react'
import { nativeSessionIdFromPath } from '../lib/nativeChatTranscript'
import { trackEvent } from '../lib/telemetry'
import { isTauri } from '../mock-tauri'

export function useNativeSessionTitleRevision(enabled: boolean, activePath?: string | null): number {
  const [revision, setRevision] = useState(0)
  const sessionId = nativeSessionIdFromPath(activePath)

  useEffect(() => {
    if (!enabled || !isTauri()) return
    let disposed = false
    let unsubscribe: UnlistenFn | undefined
    void listen<[string, boolean]>('native-chat-title-changed', ({ payload: [changedId, generated] }) => {
      if (disposed || (sessionId && sessionId !== changedId)) return
      if (sessionId && generated) trackEvent('native_session_title_generated')
      setRevision((current) => current + 1)
    }).then((remove) => {
      if (disposed) remove()
      else unsubscribe = remove
    }).catch(() => {})
    return () => {
      disposed = true
      unsubscribe?.()
    }
  }, [enabled, sessionId])

  return revision
}
