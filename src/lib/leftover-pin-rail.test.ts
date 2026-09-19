import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover pin rail', () => {
  it('pins left and parks Settings right when the rail is expanded', () => {
    const rail = readFileSync(
      `${process.cwd()}/src/components/CommandRail.tsx`,
      'utf8',
    )
    expect(rail).toContain('{pinButton}')
    expect(rail).toContain('<span className="ml-auto">{settingsButton}</span>')
    expect(rail).toContain('data-testid="command-rail-footer"')
    expect(rail).toContain('Keep as rail')
    expect(rail).toContain("aria-label={pinLabel}")
  })
})
