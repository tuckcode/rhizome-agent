import { useEffect, useRef, type RefObject } from 'react'
import { trackEvent } from '../lib/telemetry'
import { isMac } from '../utils/platform'

/**
 * Stop the running turn from the keyboard: Cmd+Period on Mac and
 * Ctrl+Period elsewhere (ADR-0193).
 *
 * The key is Period because that is the macOS convention for cancel, and
 * because the other close key already has a job in Chat: it leaves the
 * panel (useAiPanelFocus). Shift is excluded so that the Notes shortcut
 * (Cmd+Shift+Period) stays separate.
 */
export function isStopRunShortcut(event: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'>, mac: boolean = isMac()): boolean {
  if (event.key !== '.') return false
  if (event.shiftKey || event.altKey) return false
  return mac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey
}

export function stopRunShortcutLabel(mac: boolean = isMac()): string {
  return mac ? '⌘.' : 'Ctrl+.'
}

/** The `aria-keyshortcuts` value for Stop. */
export function stopRunAriaKeyShortcuts(mac: boolean = isMac()): string {
  return mac ? 'Meta+Period' : 'Control+Period'
}

/**
 * The note pane renders inside the chat panel. Cmd+Period there belongs
 * to the note, not to the run.
 */
const OUTSIDE_RUN_SCOPE = '[data-testid="chat-note-pane-region"]'
const OPEN_MODAL = '[aria-modal="true"], [role="alertdialog"], [role="dialog"][data-state="open"]'

/** Focus is in the chat panel, outside the note pane: the scope useAiPanelFocus uses for its close key. */
export function focusInRunScope(scope: HTMLElement | null, active: Element | null = document.activeElement): boolean {
  if (!scope || !active || !scope.contains(active)) return false
  return !active.closest(OUTSIDE_RUN_SCOPE)
}

function modalOpen(): boolean {
  return document.querySelector(OPEN_MODAL) !== null
}

export function useStopRunShortcut(
  isActive: boolean,
  onStop: () => void,
  scopeRef: RefObject<HTMLElement | null>,
): void {
  const onStopRef = useRef(onStop)
  useEffect(() => {
    onStopRef.current = onStop
  }, [onStop])

  useEffect(() => {
    if (!isActive) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat || event.isComposing) return
      if (!isStopRunShortcut(event)) return
      if (!focusInRunScope(scopeRef.current)) return
      if (modalOpen()) return
      event.preventDefault()
      trackEvent('chat_run_stop_shortcut')
      onStopRef.current()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isActive, scopeRef])
}
