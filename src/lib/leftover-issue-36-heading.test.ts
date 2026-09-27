import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/docs/plans/handoffs/2026-09-14-1607-issue-36-findings.md`,
  'utf8',
)

describe('leftover issue 36 heading', () => {
  it('keeps the findings heading and allows the timezone picker', () => {
    const settings = readFileSync(
      `${process.cwd()}/src/components/VaultContentSettingsSection.tsx`,
      'utf8',
    )
    expect(source).toContain('Issue #36 — timezone findings')
    expect(settings).toContain('displayTimeZone')
    expect(settings).toContain('Time zone')
  })
})
