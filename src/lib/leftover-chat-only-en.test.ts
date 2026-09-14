import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/src/lib/locales/en.json`,
  'utf8',
)

describe('leftover Chat only en string', () => {
  it('locks command.view.editorOnly as Chat only', () => {
    expect(source).toContain('"command.view.editorOnly": "Chat only"')
  })
})
