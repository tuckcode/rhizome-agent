import type { InlineSelectionRange } from './inlineWikilinkDom'
import { replaceInlineSelection } from './inlineWikilinkEdits'

export interface PendingPasteState {
  duplicatedValue: string
  expectedValue: string
  expectedSelection: InlineSelectionRange
}

export function buildPendingPasteState(
  value: string,
  selectionRange: InlineSelectionRange,
  pastedText: string,
): PendingPasteState {
  const nextState = replaceInlineSelection(value, selectionRange, pastedText)

  return {
    duplicatedValue: replaceInlineSelection(nextState.value, nextState.selection, pastedText).value,
    expectedValue: nextState.value,
    expectedSelection: nextState.selection,
  }
}

export function shouldRecoverPendingPaste(
  nextValue: string,
  pendingPaste: PendingPasteState,
): boolean {
  return (
    nextValue === pendingPaste.expectedValue ||
    nextValue === pendingPaste.duplicatedValue
  )
}
