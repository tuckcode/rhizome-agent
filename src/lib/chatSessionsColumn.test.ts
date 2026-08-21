import { describe, expect, it } from 'vitest'
import { chatSessionsOpenDefault, readChatSessionsOpen, storedChatSessionsOpen } from './chatSessionsColumn'

/**
 * The visual audit (2026-08-20) found Chat home with no left column at all:
 * the sessions list existed but defaulted closed behind a 22x22 clock in a
 * second header row, so the window people land on was an empty transcript and
 * a composer. Atticus chose "sessions open by default" over an expandable
 * icon rail.
 */
describe('the sessions column starts open', () => {
  it('opens on a machine that has never expressed a preference', () => {
    expect(readChatSessionsOpen(null)).toBe(true)
    expect(chatSessionsOpenDefault).toBe(true)
  })

  it('stays closed for someone who closed it', () => {
    expect(readChatSessionsOpen(storedChatSessionsOpen(false))).toBe(false)
  })

  it('stays open for someone who opened it again', () => {
    expect(readChatSessionsOpen(storedChatSessionsOpen(true))).toBe(true)
  })

  /**
   * A default of "open" makes unreadable storage dangerous in one direction
   * only: garbage must not be read as "closed", or a corrupted value silently
   * takes the column away and looks like the feature regressed.
   */
  it('falls back to open when the stored value is not one of ours', () => {
    expect(readChatSessionsOpen('yes')).toBe(true)
    expect(readChatSessionsOpen('')).toBe(true)
    expect(readChatSessionsOpen('{"open":false}')).toBe(true)
  })
})
