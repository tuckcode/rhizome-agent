import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/src/lib/primeRunningSessions.ts`,
  'utf8',
)

describe('leftover first-message roster', () => {
  it('locks the comment that firstMessage is the prompt Rhizome sent', () => {
    expect(source).toContain('`firstMessage` is the prompt Rhizome *sent*')
  })
})
