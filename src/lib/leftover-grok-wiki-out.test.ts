import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover grok wiki out', () => {
  it('locks Grok wiki is out of scope in ARCHITECTURE', () => {
    const arch = readFileSync(
      `${process.cwd()}/docs/ARCHITECTURE.md`,
      'utf8',
    )
    expect(arch).toContain('Grok wiki is out of')
  })

  it('does not restore docs/grok-wiki-index.md', () => {
    expect(existsSync(`${process.cwd()}/docs/grok-wiki-index.md`)).toBe(false)
  })
})
