import { APP_COMMAND_EVENT_NAME, APP_COMMAND_IDS } from '../hooks/appCommandDispatcher'
import { trackEvent } from './telemetry'

export const NOTES_CHROME_EVENT = 'rhizome:notes-chrome'
export const CONNECTIONS_OPEN_EVENT = 'rhizome:connections-open'

export type ConnectionsOpenDetail = {
  view: ConnectionsChromeView
  focusPath?: string
}

export type NotesChromeDestination = 'research' | 'settings' | 'graph' | 'mycelium'
export type ConnectionsChromeView = Extract<NotesChromeDestination, 'graph' | 'mycelium'>

let pendingConnectionsView: ConnectionsChromeView | null = null
let pendingConnectionsFocus: string | null = null

export function consumePendingConnectionsView(): ConnectionsChromeView | null {
  const view = pendingConnectionsView
  pendingConnectionsView = null
  return view
}

export function consumePendingConnectionsFocus(): string | null {
  const focus = pendingConnectionsFocus
  pendingConnectionsFocus = null
  return focus
}

export function resetNotesChromePendingForTests(): void {
  pendingConnectionsView = null
  pendingConnectionsFocus = null
}

export function openConnections(view: ConnectionsChromeView, focusPath?: string): void {
  window.dispatchEvent(new CustomEvent<ConnectionsOpenDetail>(CONNECTIONS_OPEN_EVENT, {
    detail: { view, focusPath },
  }))
}

export function dispatchNotesChrome(destination: NotesChromeDestination, focusPath?: string): void {
  trackEvent('notes_chrome_shortcut', { destination })
  if (destination === 'settings') {
    window.dispatchEvent(new CustomEvent(APP_COMMAND_EVENT_NAME, {
      detail: APP_COMMAND_IDS.appSettings,
    }))
    return
  }
  if (destination === 'graph' || destination === 'mycelium') {
    pendingConnectionsView = destination
    pendingConnectionsFocus = focusPath ?? null
  }
  window.dispatchEvent(new CustomEvent(NOTES_CHROME_EVENT, { detail: destination }))
}
