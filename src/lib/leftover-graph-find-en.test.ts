import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/src/lib/locales/en.json`,
  'utf8',
)

describe('leftover graph find en', () => {
  it('locks Find a note on graph.controls.searchPlaceholder', () => {
    expect(source).toContain(
      '"graph.controls.searchPlaceholder": "Find a note…"',
    )
  })
})
