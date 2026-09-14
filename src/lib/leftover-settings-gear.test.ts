import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover Settings gear', () => {
  it('keeps expanded Settings as a gear, not the word Settings', () => {
    const rail = readFileSync(
      `${process.cwd()}/src/components/CommandRail.tsx`,
      'utf8',
    )
    expect(rail).toContain('The Settings gear is')
    expect(rail).toContain('testId="command-rail-settings"')
    expect(rail).not.toMatch(/label=\{['"]Settings['"]\}/)
  })
})
