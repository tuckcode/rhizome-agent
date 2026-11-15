import { useEffect } from 'react'
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

export function useStopRunShortcut(isActive: boolean, onStop: () => void): void {
  useEffect(() => {
    if (!isActive) return
    function onKeyDown(event: KeyboardEvent) {
      if (!isStopRunShortcut(event)) return
      event.preventDefault()
      trackEvent('chat_run_stop_shortcut')
      onStop()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isActive, onStop])
}
