import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/src/components/ChatComposerDeck.tsx`,
  'utf8',
)

describe('leftover composer vault pill', () => {
  it('keeps composer-vault-pill out of ChatComposerDeck', () => {
    expect(source).not.toContain('composer-vault-pill')
  })

  it('does not add a Switch vault control on the composer', () => {
    expect(source).not.toMatch(/Switch vault/)
  })
})
