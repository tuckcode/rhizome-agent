import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover 36 timezone parked', () => {
  it('keeps date format and the display timezone picker', () => {
    const source = readFileSync(
      `${process.cwd()}/src/components/VaultContentSettingsSection.tsx`,
      'utf8',
    )
    expect(source).toContain('dateDisplayFormat')
    expect(source).toContain('displayTimeZone')
    expect(source).toContain('Time zone')
  })
})
