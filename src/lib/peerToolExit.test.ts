import { describe, expect, it } from 'vitest'
import {
  PEER_TOOL_EXIT_CHAT,
  PEER_TOOL_EXIT_NOTES,
  peerToolExitLabel,
  peerToolOriginFromNote,
} from './peerToolExit'

describe('peerToolExitLabel', () => {
  it('names chat when the tool opened from chat', () => {
    expect(peerToolExitLabel('chat')).toBe(PEER_TOOL_EXIT_CHAT)
  })

  it('names notes when the tool opened from a note', () => {
    expect(peerToolExitLabel('notes')).toBe(PEER_TOOL_EXIT_NOTES)
  })
})

describe('peerToolOriginFromNote', () => {
  it('uses chat when no note is open', () => {
    expect(peerToolOriginFromNote(false)).toBe('chat')
  })

  it('uses notes when a note is open', () => {
    expect(peerToolOriginFromNote(true)).toBe('notes')
  })
})
