import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover import one — list-import stays blocked', () => {
  it('locks stays blocked until Atticus says `1` in AGENTS.md', () => {
    const agents = readFileSync(`${process.cwd()}/AGENTS.md`, 'utf8')
    expect(agents).toContain('stays blocked until Atticus says `1`')
  })
})
