import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/src/lib/sensitiveTextRedaction.test.ts`,
  'utf8',
)

describe('leftover password coverage', () => {
  it('locks the redactCredentialTokens coverage limit describe', () => {
    expect(source).toContain('redactCredentialTokens coverage limit')
  })
})
