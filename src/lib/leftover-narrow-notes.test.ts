import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/src/lib/shellLayout.ts`,
  'utf8',
)

describe('leftover narrow notes', () => {
  it('locks that window width must not hide Notes', () => {
    expect(source).toContain('Window width must not hide Notes.')
  })
})
