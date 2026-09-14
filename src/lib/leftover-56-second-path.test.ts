import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/docs/plans/handoffs/2026-09-14-1602-issue-56-findings.md`,
  'utf8',
)

describe('leftover issue 56 second path', () => {
  it('locks the Issue #56 findings heading against ADR-0168', () => {
    expect(source).toContain(
      'Issue #56 findings — second provider path vs ADR-0168',
    )
  })
})
