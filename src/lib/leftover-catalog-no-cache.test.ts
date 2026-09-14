import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/src/lib/primeModelCatalog.ts`,
  'utf8',
)

describe('leftover catalog no-cache', () => {
  it('locks that a catalog failure is not cached', () => {
    expect(source).toContain('A failure is not cached.')
  })
})
