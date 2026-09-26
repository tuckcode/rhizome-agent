import { useCallback } from 'react'
import { presetToLegacy } from '../lib/panePresets'
import { trackChatNoteSplitChanged } from '../lib/productAnalytics'
import type { useViewMode } from '../hooks/useViewMode'

export type ChatNoteSplit = 'stacked' | 'side-by-side'

export function parseChatNoteSplit(value: string | null): ChatNoteSplit {
  return value === 'side-by-side' ? 'side-by-side' : 'stacked'
}

/**
 * Compatibility control. The preset owns the split and its persistence.
 *
 * An open note goes beside Chat whenever it fits (native audit 2026-09-26),
 * so On top is an explicit choice recorded on the preset, not a preset of
 * its own. Beside clears that choice; with none set it still means Read.
 */
export function useChatNoteSplit({ panePreset, setPanePreset, updatePanePreset }: Pick<ReturnType<typeof useViewMode>, 'panePreset' | 'setPanePreset' | 'updatePanePreset'>) {
  const setSplit = useCallback((next: ChatNoteSplit) => {
    if (next === 'stacked') {
      // On top keeps Chat as the canvas. Show Notes is the way to open the Notes column.
      const base = panePreset.id === 'read' ? { id: 'chat' as const, widths: panePreset.widths } : panePreset
      updatePanePreset({ ...base, stacked: true })
    } else if (panePreset.stacked) {
      updatePanePreset({ ...panePreset, stacked: false })
    } else {
      setPanePreset('read')
    }
    trackChatNoteSplitChanged(next)
  }, [panePreset, setPanePreset, updatePanePreset])
  return { split: presetToLegacy(panePreset).split, setSplit }
}
