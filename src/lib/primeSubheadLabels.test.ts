import { describe, expect, it } from 'vitest'
import { primeSessionUptime, shortPrimeSessionId, tildeVaultPath } from './primeSubheadLabels'

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

describe('primeSessionUptime', () => {
  const started = '2026-08-15T09:00:00.000Z'
  const at = (iso: string) => Date.parse(iso)

  /// Uptime is the difference between working and stuck: a few minutes of
  /// silence is thinking, a few hours of it is not.
  it('reads as minutes, then hours, then days', () => {
    expect(primeSessionUptime(started, at('2026-08-15T09:12:00.000Z'))).toBe('12m')
    expect(primeSessionUptime(started, at('2026-08-15T10:04:00.000Z'))).toBe('1h 4m')
    expect(primeSessionUptime(started, at('2026-08-17T12:00:00.000Z'))).toBe('2d 3h')
  })

  /// A round hour or day should not read "3h 0m".
  it('drops an empty trailing unit', () => {
    expect(primeSessionUptime(started, at('2026-08-15T12:00:00.000Z'))).toBe('3h')
    expect(primeSessionUptime(started, at('2026-08-17T09:00:00.000Z'))).toBe('2d')
  })

  /// Seconds would tick distractingly in a status strip and answer a question
  /// nobody asks.
  it('collapses anything under a minute', () => {
    expect(primeSessionUptime(started, at('2026-08-15T09:00:30.000Z'))).toBe('<1m')
    expect(primeSessionUptime(started, at('2026-08-15T09:00:00.000Z'))).toBe('<1m')
  })

  /// A session with no start time, or an unreadable one, shows nothing rather
  /// than a wrong number — and clock skew must not render a negative age.
  it('shows nothing rather than a wrong number', () => {
    expect(primeSessionUptime(null)).toBeNull()
    expect(primeSessionUptime(undefined)).toBeNull()
    expect(primeSessionUptime('   ')).toBeNull()
    expect(primeSessionUptime('not a date')).toBeNull()
    expect(primeSessionUptime(started, at('2026-08-15T08:59:00.000Z'))).toBeNull()
  })
})
