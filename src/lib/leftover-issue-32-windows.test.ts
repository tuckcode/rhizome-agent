import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/docs/plans/handoffs/2026-09-14-1615-issue-32-findings.md`,
  'utf8',
)

describe('leftover issue 32 windows findings', () => {
  it('locks the Issue #32 Windows named-pipe findings heading', () => {
    expect(source).toContain('Issue #32 — Windows named-pipe findings')
  })
})
