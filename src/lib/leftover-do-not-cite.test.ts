import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/AGENTS.md`,
  'utf8',
)

describe('leftover do not cite doctrine as decided', () => {
  it('locks that ADR-0168 must not be cited as decided until #56 is resolved', () => {
    expect(source).toContain(
      'Do not cite it as decided when arguing to adopt or reject a tool until #56 is resolved.',
    )
  })
})
