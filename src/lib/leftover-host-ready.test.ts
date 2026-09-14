import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/src/components/PrimeModelPicker.tsx`,
  'utf8',
)

describe('leftover host ready', () => {
  it('locks the host-ready vaultPath retry guard', () => {
    expect(source).toContain('if (!hostReady && vaultPath)')
  })
})
