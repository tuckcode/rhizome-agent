import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/docs/plans/handoffs/2026-09-14-1614-issue-23-findings.md`,
  'utf8',
)

describe('leftover issue 23 session search', () => {
  it('locks the issue 23 session search findings heading', () => {
    expect(source).toContain('Issue #23 — session search findings')
  })
})
