import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover 36 timezone parked', () => {
  it('locks dateDisplayFormat and keeps timezone out of vault content settings', () => {
    const source = readFileSync(
      `${process.cwd()}/src/components/VaultContentSettingsSection.tsx`,
      'utf8',
    )
    expect(source).toContain('dateDisplayFormat')
    expect(source).not.toMatch(/timezone|timeZone|America\/Chicago/)
  })
})
