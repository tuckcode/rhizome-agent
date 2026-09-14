import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/docs/plans/handoffs/2026-09-14-1617-issue-48-findings.md`,
  'utf8',
)

describe('leftover omniroute parked', () => {
  it('locks that there is no OmniRoute code in tree', () => {
    expect(source).toContain('No OmniRoute code in tree')
  })
})
