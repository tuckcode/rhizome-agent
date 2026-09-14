import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/src/components/usePrimeSessionSwitcher.ts`,
  'utf8',
)

describe('leftover transcript clear', () => {
  it('locks replaceMessages([]) clearing the stale transcript on session switch', () => {
    expect(source).toContain('agent.replaceMessages([])')
    expect(source).toContain('Clear the stale transcript in the same')
  })
})
