import { useEffect } from 'react'
import type { MultiSelectState } from '../../hooks/useMultiSelect'

interface UseMultiSelectKeyboardOptions {
  multiSelect: MultiSelectState
  isEntityView: boolean
  onBulkOrganize?: () => void
  onBulkDelete?: () => void
  enableActionShortcuts?: boolean
}

function isInputHtmlElementFocused(): boolean {
  const activeHTMLElement = document.activeElement
  if (!(activeHTMLElement instanceof HTMLElement)) return false

  return activeHTMLElement.tagName === 'INPUT'
    || activeHTMLElement.tagName === 'TEXTAREA'
    || activeHTMLElement.isContentEditable
}

function usesCommandModifier(event: KeyboardEvent): boolean {
  return event.metaKey || event.ctrlKey
}

function clearSelectionOnEscape(event: KeyboardEvent, multiSelect: MultiSelectState) {
  if (event.key !== 'Escape' || !multiSelect.isMultiSelecting) return
  event.preventDefault()
  multiSelect.clear()
}

function selectVisibleNotes(event: KeyboardEvent, multiSelect: MultiSelectState, isEntityView: boolean) {
  if (event.key !== 'a' || !(event.metaKey || event.ctrlKey) || isEntityView || isInputHtmlElementFocused()) return
  event.preventDefault()
  multiSelect.selectAll()
}

function canRunBulkShortcut(
  event: KeyboardEvent,
  options: Pick<UseMultiSelectKeyboardOptions, 'multiSelect' | 'enableActionShortcuts'>,
): boolean {
  return Boolean(
    options.enableActionShortcuts
    && !event.defaultPrevented
    && options.multiSelect.isMultiSelecting
    && usesCommandModifier(event),
  )
}

function isOrganizeShortcut(event: KeyboardEvent, onBulkOrganize: (() => void) | undefined): onBulkOrganize is () => void {
  return event.key === 'e' && !!onBulkOrganize
}

function isDeleteShortcut(event: KeyboardEvent, onBulkDelete: (() => void) | undefined): onBulkDelete is () => void {
  return (event.key === 'Backspace' || event.key === 'Delete') && !!onBulkDelete
}

function runBulkShortcut(
  event: KeyboardEvent,
  options: Pick<UseMultiSelectKeyboardOptions, 'multiSelect' | 'onBulkOrganize' | 'onBulkDelete' | 'enableActionShortcuts'>,
) {
  if (!canRunBulkShortcut(event, options)) return

  if (isOrganizeShortcut(event, options.onBulkOrganize)) {
    event.preventDefault()
    options.onBulkOrganize()
    return
  }

  if (!isDeleteShortcut(event, options.onBulkDelete)) return

  event.preventDefault()
  options.onBulkDelete()
}

export function useMultiSelectKeyboard(options: UseMultiSelectKeyboardOptions) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      clearSelectionOnEscape(event, options.multiSelect)
      selectVisibleNotes(event, options.multiSelect, options.isEntityView)
      runBulkShortcut(event, options)
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [options])
}
