import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/src/components/PrimeProviderStatusSection.tsx`,
  'utf8',
)

describe('leftover Nous Portal add to Chat list', () => {
  it('locks the nous-portal Add to Chat list button label', () => {
    expect(source).toContain(
      "if (provider.name === 'nous-portal') return 'Add to Chat list'",
    )
  })
})
