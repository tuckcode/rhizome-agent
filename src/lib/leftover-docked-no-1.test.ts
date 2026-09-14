import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/docs/plans/handoffs/2026-09-14-1145-cursor-grok-4-6-docked-questions.md`,
  'utf8',
)

describe('leftover docked no one', () => {
  it('locks the docked leftover: do not type one, do not merge #66', () => {
    expect(source).toContain('Do not type `1`. Do not merge #66.')
  })
})
