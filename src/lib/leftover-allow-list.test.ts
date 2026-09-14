import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/src/components/PrimeModelAllowListSection.tsx`,
  'utf8',
)

describe('leftover allow list', () => {
  it('locks Chat model menu heading', () => {
    expect(source).toContain('Chat model menu')
  })

  it("locks Choose which of Prime's models appear in the chat model menu", () => {
    expect(source).toContain(
      "Choose which of Prime's models appear in the chat model menu",
    )
  })
})
