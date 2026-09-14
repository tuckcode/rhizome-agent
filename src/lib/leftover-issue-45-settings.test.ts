import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/docs/plans/handoffs/2026-09-14-1611-issue-45-findings.md`,
  'utf8',
)

describe('leftover issue 45 model settings', () => {
  it('locks the #45 findings heading that model settings stay open', () => {
    expect(source).toContain('#45 model settings findings — 2026-09-14 16:11')
  })
})
