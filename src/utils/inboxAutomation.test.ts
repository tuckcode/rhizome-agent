import { describe, expect, it } from 'vitest'
import { isInboxAutomationEnabled } from './inboxAutomation'

describe('isInboxAutomationEnabled', () => {
  it('defaults ON when the setting has never been written', () => {
    expect(isInboxAutomationEnabled(null)).toBe(true)
    expect(isInboxAutomationEnabled(undefined)).toBe(true)
  })

  it('honors an explicit opt-out', () => {
    expect(isInboxAutomationEnabled(false)).toBe(false)
  })

  it('honors an explicit opt-in', () => {
    expect(isInboxAutomationEnabled(true)).toBe(true)
  })
})
