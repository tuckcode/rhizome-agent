import { describe, expect, it } from 'vitest'
import { shortPrimeSessionId, tildeVaultPath } from './primeSubheadLabels'

describe('shortPrimeSessionId', () => {
  /**
   * Prime's ids are uuidv7: the leading characters are a timestamp and are
   * identical for sessions started in the same hour, so a prefix would show
   * the same four characters for every session in a day's work.
   */
  it('takes the random tail, not the timestamp prefix', () => {
    const a = shortPrimeSessionId('019fe641-61fa-73e9-82ef-91fc90097aab')
    const b = shortPrimeSessionId('019fe641-61fa-73e9-82ef-91fc9009ffff')

    expect(a).toBe('7aab')
    expect(b).toBe('ffff')
    expect(a).not.toBe(b)
  })

  it('handles an id with no dashes', () => {
    expect(shortPrimeSessionId('abcdef123456')).toBe('3456')
  })

  it('has nothing to show without an id', () => {
    expect(shortPrimeSessionId(null)).toBeNull()
    expect(shortPrimeSessionId('   ')).toBeNull()
  })
})

describe('tildeVaultPath', () => {
  it('collapses the home directory on macOS and linux paths', () => {
    expect(tildeVaultPath('/Users/dtc/Documents/Laputa')).toBe('~/Documents/Laputa')
    expect(tildeVaultPath('/home/dtc/vault')).toBe('~/vault')
  })

  it('prefers an explicit home directory when given one', () => {
    expect(tildeVaultPath('/mnt/data/vault', '/mnt/data')).toBe('~/vault')
  })

  /** Shortening must never turn one location into a different-looking one. */
  it('leaves a path outside home untouched', () => {
    expect(tildeVaultPath('/opt/shared/vault')).toBe('/opt/shared/vault')
  })

  it('has nothing to show without a path', () => {
    expect(tildeVaultPath(null)).toBeNull()
    expect(tildeVaultPath('  ')).toBeNull()
  })
})
