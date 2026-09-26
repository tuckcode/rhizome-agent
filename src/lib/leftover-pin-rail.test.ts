import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover pin rail', () => {
  it('keeps the sidebar control and parks Settings right when the rail is expanded', () => {
    const rail = readFileSync(
      `${process.cwd()}/src/components/CommandRail.tsx`,
      'utf8',
    )
    expect(rail).not.toContain('{pinButton}')
    expect(rail).toContain('{expandButton}')
    expect(rail).toContain('<span className="ml-auto">{settingsButton}</span>')
    expect(rail).toContain('data-testid="command-rail-footer"')
    expect(rail).toContain('const overlaying = false')
  })
})
