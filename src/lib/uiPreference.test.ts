import { describe, expect, it } from 'vitest'
import {
  readBooleanPreference,
  readStoredBooleanPreference,
  storedBooleanPreference,
  writeStoredBooleanPreference,
} from './uiPreference'

describe('remembered on/off preferences', () => {
  it('round-trips both states', () => {
    expect(readBooleanPreference(storedBooleanPreference(true), false)).toBe(true)
    expect(readBooleanPreference(storedBooleanPreference(false), true)).toBe(false)
  })

  it('falls back to the feature default rather than to off', () => {
    expect(readBooleanPreference(null, true)).toBe(true)
    expect(readBooleanPreference('yes', true)).toBe(true)
    expect(readBooleanPreference('', true)).toBe(true)
    expect(readBooleanPreference('{"open":false}', true)).toBe(true)
    expect(readBooleanPreference(null, false)).toBe(false)
  })

  it('reads and writes through storage', () => {
    localStorage.clear()
    expect(readStoredBooleanPreference('k', true)).toBe(true)
    writeStoredBooleanPreference('k', false)
    expect(localStorage.getItem('k')).toBe('0')
    expect(readStoredBooleanPreference('k', true)).toBe(false)
  })
})
