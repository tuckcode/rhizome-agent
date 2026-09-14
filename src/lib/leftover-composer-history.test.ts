import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/src/lib/composerPromptHistory.ts`,
  'utf8',
)

describe('leftover composer prompt history', () => {
  it('locks ArrowUp older / ArrowDown newer', () => {
    expect(source).toContain('ArrowUp → older, ArrowDown → newer')
  })

  it('locks in-memory Ask-box recall comments already in the source', () => {
    expect(source).toContain('Oldest → newest.')
    expect(source).toContain('Consecutive duplicates are skipped.')
  })
})
