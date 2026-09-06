/**
 * Session-scoped Ask-box recall (C71).
 *
 * Up/Down browse previously sent prompts, like a shell. In-memory only for v1.
 */

export const MAX_COMPOSER_PROMPT_HISTORY = 50

export type ComposerPromptHistoryState = {
  /** Oldest → newest. */
  entries: string[]
  /**
   * Index into `entries` while browsing, or `-1` when editing a live draft.
   */
  index: number
  /** Draft text captured when Up first leaves live edit. */
  draftBeforeBrowse: string
}

export function emptyComposerPromptHistory(): ComposerPromptHistoryState {
  return { entries: [], index: -1, draftBeforeBrowse: '' }
}

/** Push a sent prompt. Consecutive duplicates are skipped. */
export function pushComposerPrompt(
  state: ComposerPromptHistoryState,
  text: string,
): ComposerPromptHistoryState {
  const trimmed = text.trim()
  if (!trimmed) {
    return { ...state, index: -1, draftBeforeBrowse: '' }
  }
  const last = state.entries[state.entries.length - 1]
  const entries = last === trimmed
    ? state.entries
    : [...state.entries, trimmed].slice(-MAX_COMPOSER_PROMPT_HISTORY)
  return { entries, index: -1, draftBeforeBrowse: '' }
}

/**
 * True when Up/Down should recall history instead of moving the caret.
 * Prefer: empty box, or caret collapsed at the start (do not steal mid-line Up).
 */
export function canBrowseComposerPromptHistory(args: {
  value: string
  selectionStart: number
  selectionEnd: number
  suggestionsOpen: boolean
}): boolean {
  if (args.suggestionsOpen) return false
  if (args.selectionStart !== args.selectionEnd) return false
  if (args.value.length === 0) return true
  return args.selectionStart === 0
}

export type PromptHistoryNavigateResult = {
  state: ComposerPromptHistoryState
  /** Text to put in the composer. */
  text: string
  /** Whether the key was handled (caller should preventDefault). */
  handled: boolean
}

/**
 * ArrowUp → older, ArrowDown → newer. Restores the live draft when leaving
 * the newest entry downward.
 */
export function navigateComposerPromptHistory(
  state: ComposerPromptHistoryState,
  direction: 'up' | 'down',
  currentValue: string,
): PromptHistoryNavigateResult {
  if (state.entries.length === 0) {
    return { state, text: currentValue, handled: false }
  }

  if (direction === 'up') {
    if (state.index === -1) {
      const nextIndex = state.entries.length - 1
      return {
        state: {
          entries: state.entries,
          index: nextIndex,
          draftBeforeBrowse: currentValue,
        },
        text: state.entries[nextIndex] ?? currentValue,
        handled: true,
      }
    }
    if (state.index <= 0) {
      return { state, text: state.entries[0] ?? currentValue, handled: true }
    }
    const nextIndex = state.index - 1
    return {
      state: { ...state, index: nextIndex },
      text: state.entries[nextIndex] ?? currentValue,
      handled: true,
    }
  }

  // down
  if (state.index === -1) {
    return { state, text: currentValue, handled: false }
  }
  if (state.index >= state.entries.length - 1) {
    return {
      state: { ...state, index: -1 },
      text: state.draftBeforeBrowse,
      handled: true,
    }
  }
  const nextIndex = state.index + 1
  return {
    state: { ...state, index: nextIndex },
    text: state.entries[nextIndex] ?? currentValue,
    handled: true,
  }
}
