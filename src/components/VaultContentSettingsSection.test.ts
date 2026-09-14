import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('VaultContentSettingsSection #36 leftover', () => {
  it('still has date-format only — no timezone picker this window', () => {
    const source = readFileSync(
      `${process.cwd()}/src/components/VaultContentSettingsSection.tsx`,
      'utf8',
    )
    expect(source).toContain('dateDisplayFormat')
    expect(source).not.toMatch(/timezone|timeZone|America\/Chicago/)
  })
})
