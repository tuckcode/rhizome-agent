import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/src/hooks/usePrimeHostStatus.ts`,
  'utf8',
)

describe('leftover corroborated problem', () => {
  it('locks withCorroboratedProblem', () => {
    expect(source).toContain('function withCorroboratedProblem')
    expect(source).toContain(
      'status: corroborated || code === null ? next : { ...next, problem: null }',
    )
  })
})
