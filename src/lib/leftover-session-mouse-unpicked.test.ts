import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/docs/plans/handoffs/2026-09-14-1627-session-mouse-back-findings.md`,
  'utf8',
)

describe('leftover session mouse unpicked', () => {
  it('locks the unpicked session-mouse-back winner stamp', () => {
    expect(source).toContain('**Unpicked** — stamped 16:26 still no winner')
  })
})
