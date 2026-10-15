import { describe, expect, it } from 'vitest'
import {
  PEER_TOOL_EXIT_CHAT,
  PEER_TOOL_EXIT_NOTES,
  peerToolExitLabel,
  peerToolOriginFromScreen,
} from './peerToolExit'

describe('peerToolExitLabel', () => {
  it('names chat when the tool opened from chat', () => {
    expect(peerToolExitLabel('chat')).toBe(PEER_TOOL_EXIT_CHAT)
  })

  it('names notes when the tool opened from a note', () => {
    expect(peerToolExitLabel('notes')).toBe(PEER_TOOL_EXIT_NOTES)
  })

  it('runs both labels through translate()', () => {
    expect(peerToolExitLabel('chat', 'en')).toBe('Back to chat')
    expect(peerToolExitLabel('notes', 'en')).toBe('Back to notes')
  })
})

describe('peerToolOriginFromScreen', () => {
  it('uses chat when a note is not on screen', () => {
    expect(peerToolOriginFromScreen(false)).toBe('chat')
  })

  it('uses notes when a note or inbox is on screen', () => {
    expect(peerToolOriginFromScreen(true)).toBe('notes')
  })
})
