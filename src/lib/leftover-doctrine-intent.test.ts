import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/AGENTS.md`,
  'utf8',
)

describe('leftover doctrine intent', () => {
  it('locks that ADR-0168 is design intent, not settled fact', () => {
    expect(source).toContain(
      'Selective harness doctrine (ADR-0168) is design intent, not settled fact',
    )
  })
})
