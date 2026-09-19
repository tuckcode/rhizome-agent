import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/src/lib/locales/en.json`,
  'utf8',
)

describe('leftover Chat en string', () => {
  it('locks command.view.editorOnly as Chat', () => {
    expect(source).toContain('"command.view.editorOnly": "Chat"')
    expect(source).not.toContain('"command.view.editorOnly": "Chat only"')
  })
})
