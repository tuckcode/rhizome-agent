import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover rail keyboard path and hover overlay', () => {
  const rail = readFileSync(
    `${process.cwd()}/src/components/CommandRail.tsx`,
    'utf8',
  )
  const panel = readFileSync(
    `${process.cwd()}/src/components/AiPanel.tsx`,
    'utf8',
  )

  it('keeps an Expand control on the compact rail', () => {
    expect(rail).toContain('data-testid="command-rail-expand"')
    expect(rail).toContain("'Expand sidebar'")
    expect(rail).toContain("'Collapse sidebar'")
    expect(rail).toContain('{expandButton}')
  })

  it('lets Chat under a hover overlay keep pointer events', () => {
    expect(rail).toContain("pointerEvents: overlaying ? 'none'")
    expect(rail).toContain('data-overlay={overlaying ? \'true\' : \'false\'}')
    expect(rail).toContain('data-testid="command-rail-hover-hit"')
    expect(panel).toContain('data-testid="command-rail-session-hits"')
    expect(panel).toContain("style={{ pointerEvents: 'none' }}")
  })
})
