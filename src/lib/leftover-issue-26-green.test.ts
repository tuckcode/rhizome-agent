import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/docs/plans/handoffs/2026-09-14-1608-issue-26-findings.md`,
  'utf8',
)

describe('leftover issue 26 green bar', () => {
  it('locks the Issue #26 Rhizome green bar vs Prime updater leftover heading', () => {
    expect(source).toContain(
      'Issue #26 — Rhizome green bar vs Prime updater leftover',
    )
  })
})
