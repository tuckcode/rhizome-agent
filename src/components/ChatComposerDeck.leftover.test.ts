import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/src/components/ChatComposerDeck.tsx`,
  'utf8',
)

describe('ChatComposerDeck leftover', () => {
  it('has no composer-vault-pill', () => {
    expect(source).not.toContain('composer-vault-pill')
  })

  it('keeps vaultPath optional', () => {
    expect(source).toContain('vaultPath?: string')
  })

  it('has no Switch vault copy', () => {
    expect(source).not.toMatch(/Switch vault/)
  })
})
