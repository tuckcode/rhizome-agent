import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/docs/plans/handoffs/2026-09-14-1607-issue-36-findings.md`,
  'utf8',
)

describe('leftover issue 36 heading', () => {
  it('locks the issue 36 timezone findings heading', () => {
    expect(source).toContain('Issue #36 — timezone findings')
  })
})
