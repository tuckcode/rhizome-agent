import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/src/utils/messageTimestamp.ts`,
  'utf8',
)

describe('leftover C70 clock labels', () => {
  it('locks new-session naming style (`3:35p`)', () => {
    expect(source).toContain('Matches new-session naming style (`3:35p`)')
  })

  it('locks local clock like `3:35p` / `12:05a`', () => {
    expect(source).toContain('Local clock like `3:35p` / `12:05a`')
  })
})
