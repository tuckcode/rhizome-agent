import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('VaultContentSettingsSection timezone', () => {
  it('puts a display timezone picker next to date format', () => {
    const source = readFileSync(
      `${process.cwd()}/src/components/VaultContentSettingsSection.tsx`,
      'utf8',
    )
    expect(source).toContain('dateDisplayFormat')
    expect(source).toContain('displayTimeZone')
    expect(source).toContain('Time zone')
    expect(source).toContain('Same as this computer')
    expect(source).toContain('SelectControl')
  })
})
