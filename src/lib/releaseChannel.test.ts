import { describe, expect, it } from 'vitest'
import {
  normalizeReleaseChannel,
  serializeReleaseChannel,
  type ReleaseChannel,
} from './releaseChannel'

describe('releaseChannel', () => {
  it('normalizes only alpha explicitly', () => {
    expect(normalizeReleaseChannel('alpha')).toBe('alpha')
    expect(normalizeReleaseChannel('  ALPHA  ')).toBe('alpha')
  })

  it('falls back to stable for legacy or invalid values', () => {
    expect(normalizeReleaseChannel(null)).toBe('stable')
    expect(normalizeReleaseChannel('stable')).toBe('stable')
    expect(normalizeReleaseChannel('beta')).toBe('stable')
    expect(normalizeReleaseChannel('invalid')).toBe('stable')
  })

  it('serializes stable back to the persisted default shape', () => {
    expect(serializeReleaseChannel('stable')).toBeNull()
    expect(serializeReleaseChannel('alpha')).toBe('alpha')
  })

  it('roundtrips persisted values through the normalized channel model', () => {
    const channels: Array<[string | null, ReleaseChannel]> = [
      ['alpha', 'alpha'],
      ['stable', 'stable'],
      ['beta', 'stable'],
      [null, 'stable'],
    ]

    for (const [persistedValue, expectedChannel] of channels) {
      expect(normalizeReleaseChannel(persistedValue)).toBe(expectedChannel)
    }
  })
})
