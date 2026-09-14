import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/docs/plans/handoffs/2026-09-14-1601-issue-57-findings.md`,
  'utf8',
)

describe('leftover issue 57 compatibility', () => {
  it('locks the #57 findings heading that names compatibility code for users who do not exist', () => {
    expect(source).toContain(
      '#57 findings — compatibility code for users who do not exist',
    )
  })
})
