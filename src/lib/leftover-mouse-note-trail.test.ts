import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/src/hooks/useNavigationGestures.ts`,
  'utf8',
)

describe('leftover mouse note trail', () => {
  it('locks mouse back/forward on the note trail', () => {
    expect(source).toContain(
      'Mouse back/forward buttons walk the note trail: note → wikilink → note.',
    )
  })

  it('does not switch sessions from those buttons', () => {
    expect(source).not.toMatch(/switchPrimeSession|onSelectSession/)
  })
})
