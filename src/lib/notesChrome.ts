import { APP_COMMAND_EVENT_NAME, APP_COMMAND_IDS } from '../hooks/appCommandDispatcher'
import { trackEvent } from './telemetry'

export const NOTES_CHROME_EVENT = 'rhizome:notes-chrome'

export type NotesChromeDestination = 'research' | 'settings' | 'graph' | 'mycelium'
export type ConnectionsChromeView = Extract<NotesChromeDestination, 'graph' | 'mycelium'>

let pendingConnectionsView: ConnectionsChromeView | null = null

export function consumePendingConnectionsView(): ConnectionsChromeView | null {
  const view = pendingConnectionsView
  pendingConnectionsView = null
  return view
}

export function resetNotesChromePendingForTests(): void {
  pendingConnectionsView = null
}

export function dispatchNotesChrome(destination: NotesChromeDestination): void {
  trackEvent('notes_chrome_shortcut', { destination })
  if (destination === 'settings') {
    window.dispatchEvent(new CustomEvent(APP_COMMAND_EVENT_NAME, {
      detail: APP_COMMAND_IDS.appSettings,
    }))
    return
  }
  if (destination === 'graph' || destination === 'mycelium') {
    pendingConnectionsView = destination
  }
  if (destination === 'mycelium') {
    window.dispatchEvent(new CustomEvent(APP_COMMAND_EVENT_NAME, {
      detail: APP_COMMAND_IDS.goChanges,
    }))
  }
  window.dispatchEvent(new CustomEvent(NOTES_CHROME_EVENT, { detail: destination }))
}
