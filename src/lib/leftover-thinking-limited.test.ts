import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/src/lib/locales/en.json`,
  'utf8',
)

describe('leftover thinking model limited', () => {
  it('locks Limited by this model on the existing key', () => {
    expect(source).toContain(
      '"ai.composer.thinkingModelLimited": "Limited by this model"',
    )
  })
})
