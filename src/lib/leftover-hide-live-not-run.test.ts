import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/docs/plans/handoffs/2026-09-14-1623-hide-on-close-findings.md`,
  'utf8',
)

describe('leftover hide-on-close live check', () => {
  it('locks the native live-check heading that this pass was not run', () => {
    expect(source).toContain('Native live-check (NOT RUN)')
  })
})
