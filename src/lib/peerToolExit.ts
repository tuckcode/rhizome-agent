import { translate, type AppLocale, DEFAULT_APP_LOCALE } from './i18n'

export type PeerToolOrigin = 'chat' | 'notes'

export const PEER_TOOL_EXIT_CHAT = 'Back to chat'
export const PEER_TOOL_EXIT_NOTES = 'Back to notes'

/** Exit copy names the surface the tool will restore. */
export function peerToolExitLabel(
  origin: PeerToolOrigin,
  locale: AppLocale = DEFAULT_APP_LOCALE,
): string {
  return translate(locale, origin === 'notes' ? 'graph.exitNotes' : 'graph.exit')
}

/** Chat when chat is on screen. Notes when the note or inbox is on screen. */
export function peerToolOriginFromScreen(noteOnScreen: boolean): PeerToolOrigin {
  return noteOnScreen ? 'notes' : 'chat'
}
