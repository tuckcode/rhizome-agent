import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/docs/plans/handoffs/2026-09-14-1610-issue-5-findings.md`,
  'utf8',
)

describe('leftover issue 5 snapshot', () => {
  it('locks the Issue #5 snapshot vs spoken leftover heading', () => {
    expect(source).toContain('Issue #5 — snapshot vs spoken leftover')
  })
})
