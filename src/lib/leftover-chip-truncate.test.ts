import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/src/components/ChatComposerDeck.tsx`,
  'utf8',
)

describe('leftover chip truncate', () => {
  it('locks composer context labels to min-w-0 truncate', () => {
    expect(source).toContain('min-w-0 truncate')
  })
})
