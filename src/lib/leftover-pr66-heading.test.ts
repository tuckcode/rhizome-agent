import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/docs/plans/handoffs/2026-09-14-1624-pr66-findings.md`,
  'utf8',
)

describe('leftover PR #66 heading', () => {
  it('locks the keep-copied findings heading that still forbids merge', () => {
    expect(source).toContain('PR #66 findings — KEEP copied, still do not merge')
  })
})
