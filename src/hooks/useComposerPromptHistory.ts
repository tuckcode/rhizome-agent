import { useCallback, useRef } from 'react'
import {
  canBrowseComposerPromptHistory,
  emptyComposerPromptHistory,
  navigateComposerPromptHistory,
  pushComposerPrompt,
  type ComposerPromptHistoryState,
} from '../lib/composerPromptHistory'

/**
 * Session-scoped Up/Down recall for the Chat Ask box (C71).
 * State is in-memory only; cleared when the panel unmounts.
 */
export function useComposerPromptHistory(onChange: (value: string) => void) {
  const stateRef = useRef<ComposerPromptHistoryState>(emptyComposerPromptHistory())

  const recordSent = useCallback((text: string) => {
    stateRef.current = pushComposerPrompt(stateRef.current, text)
  }, [])

  const browse = useCallback((
    direction: 'up' | 'down',
    meta: {
      value: string
      selectionStart: number
      selectionEnd: number
      suggestionsOpen: boolean
    },
  ): boolean => {
    if (!canBrowseComposerPromptHistory(meta)) return false
    const result = navigateComposerPromptHistory(stateRef.current, direction, meta.value)
    if (!result.handled) return false
    stateRef.current = result.state
    onChange(result.text)
    return true
  }, [onChange])

  return { recordSent, browse }
}
