import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/docs/plans/handoffs/2026-09-14-1609-issue-13-findings.md`,
  'utf8',
)

describe('leftover issue 13 roster', () => {
  it('locks the menu bar running roster findings heading', () => {
    expect(source).toContain('#13 — Menu bar running roster — findings')
  })
})
