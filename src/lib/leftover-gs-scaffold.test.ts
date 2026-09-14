import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover Getting Started scaffold errors', () => {
  const source = readFileSync(
    `${process.cwd()}/src/utils/gettingStartedVault.ts`,
    'utf8',
  )

  it('locks Failed to create scaffold folder', () => {
    expect(source).toContain("'Failed to create scaffold folder'")
  })

  it('locks Could not create Getting Started vault', () => {
    expect(source).toContain('Could not create Getting Started vault')
  })
})
