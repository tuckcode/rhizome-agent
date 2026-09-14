import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/src/components/inlineWikilinkKeydown.ts`,
  'utf8',
)

describe('leftover Enter send', () => {
  it('locks send as plain Enter (Shift+Enter does not submit)', () => {
    expect(source).toContain("if (event.key !== 'Enter' || event.shiftKey) return false")
  })
})
