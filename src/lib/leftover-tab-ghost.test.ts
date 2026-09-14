import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover Tab ghost-text (#51)', () => {
  const input = readFileSync(
    `${process.cwd()}/src/components/InlineWikilinkInput.tsx`,
    'utf8',
  )
  const suggestions = readFileSync(
    `${process.cwd()}/src/lib/replySuggestions.ts`,
    'utf8',
  )

  it('locks Tab ghost-text accept on the composer input', () => {
    expect(input).toContain('Tab ghost-text accept (#51)')
  })

  it('locks Case 2 as deliberately unbuilt in reply suggestions', () => {
    expect(suggestions).toContain('That is case 2 in #51')
    expect(suggestions).toContain('Deliberately not built here')
  })
})
