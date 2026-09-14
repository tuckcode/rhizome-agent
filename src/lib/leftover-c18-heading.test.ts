import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/docs/plans/handoffs/2026-09-14-1629-c18-welcome-findings.md`,
  'utf8',
)

describe('leftover C18 welcome heading', () => {
  it('locks the C18 Welcome Download leftover heading', () => {
    expect(source).toContain('C18 — Welcome Download words leftover')
  })
})
