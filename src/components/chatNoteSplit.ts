import { useCallback, useState } from 'react'
import { APP_STORAGE_KEYS } from '../constants/appStorage'
import { trackChatNoteSplitChanged } from '../lib/productAnalytics'

export type ChatNoteSplit = 'stacked' | 'side-by-side'

export function parseChatNoteSplit(value: string | null): ChatNoteSplit {
  return value === 'side-by-side' ? 'side-by-side' : 'stacked'
}

export function shouldForceChatShellCompact(split: ChatNoteSplit, noteOpen: boolean): boolean {
  return noteOpen && split === 'side-by-side'
}

export function useChatNoteSplit(): {
  split: ChatNoteSplit
  setSplit: (next: ChatNoteSplit) => void
} {
  const [split, setSplitState] = useState<ChatNoteSplit>(() => {
    try {
      return parseChatNoteSplit(window.localStorage.getItem(APP_STORAGE_KEYS.chatNoteSplit))
    } catch {
      return 'stacked'
    }
  })

  const setSplit = useCallback((next: ChatNoteSplit) => {
    setSplitState(next)
    try {
      window.localStorage.setItem(APP_STORAGE_KEYS.chatNoteSplit, next)
    } catch {
      // A refused write costs the memory of the layout, not the click.
    }
    trackChatNoteSplitChanged(next)
  }, [])

  return { split, setSplit }
}
