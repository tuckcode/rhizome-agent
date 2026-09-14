import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/src/components/ChatComposerDeck.tsx`,
  'utf8',
)

describe('leftover composer optional vault', () => {
  it('locks vaultPath as optional on ChatComposerDeck', () => {
    expect(source).toContain('vaultPath?: string')
    expect(source).not.toMatch(/if \(!vaultPath\)/)
  })
})
