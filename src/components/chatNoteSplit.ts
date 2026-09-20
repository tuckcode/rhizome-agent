import { useCallback } from 'react'
import { presetToLegacy } from '../lib/panePresets'
import { trackChatNoteSplitChanged } from '../lib/productAnalytics'
import type { useViewMode } from '../hooks/useViewMode'

export type ChatNoteSplit = 'stacked' | 'side-by-side'

export function parseChatNoteSplit(value: string | null): ChatNoteSplit {
  return value === 'side-by-side' ? 'side-by-side' : 'stacked'
}

/** Compatibility control. The preset owns the split and its persistence. */
export function useChatNoteSplit({ panePreset, setPanePreset }: Pick<ReturnType<typeof useViewMode>, 'panePreset' | 'setPanePreset'>) {
  const setSplit = useCallback((next: ChatNoteSplit) => {
    // On top keeps Chat as the canvas. Show Notes is the way to open the Notes column.
    setPanePreset(next === 'side-by-side' ? 'read' : 'chat')
    trackChatNoteSplitChanged(next)
  }, [setPanePreset])
  return { split: presetToLegacy(panePreset).split, setSplit }
}
