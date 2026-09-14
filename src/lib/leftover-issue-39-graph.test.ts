import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/docs/plans/handoffs/2026-09-14-1613-issue-39-findings.md`,
  'utf8',
)

describe('leftover issue 39 graph as agent tool', () => {
  it('locks the issue 39 graph-as-agent-tool findings heading', () => {
    expect(source).toContain('Issue #39 — graph as agent tool findings')
  })
})
