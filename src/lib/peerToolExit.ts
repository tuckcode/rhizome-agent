export type PeerToolOrigin = 'chat' | 'notes'

export const PEER_TOOL_EXIT_CHAT = 'Back to chat'
export const PEER_TOOL_EXIT_NOTES = 'Back to notes'

/** Exit copy names the surface the tool will restore. */
export function peerToolExitLabel(origin: PeerToolOrigin): string {
  return origin === 'notes' ? PEER_TOOL_EXIT_NOTES : PEER_TOOL_EXIT_CHAT
}

/** Chat when no note is open. Notes when a note is on screen. */
export function peerToolOriginFromNote(hasOpenNote: boolean): PeerToolOrigin {
  return hasOpenNote ? 'notes' : 'chat'
}
