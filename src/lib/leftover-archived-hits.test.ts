import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/src/components/PrimeSessionList.tsx`,
  'utf8',
)

describe('leftover archived search hits', () => {
  it('locks showing archived rows when search has hits', () => {
    expect(source).toContain(
      'const showArchived = archiveOpen || (searching && visibleArchived.length > 0)',
    )
  })
})
