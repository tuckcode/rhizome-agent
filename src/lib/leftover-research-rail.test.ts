import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover research rail', () => {
  it('keeps Research in the command-rail Views group', () => {
    const rail = readFileSync(
      `${process.cwd()}/src/components/CommandRail.tsx`,
      'utf8',
    )
    expect(rail).toContain('testId={view.testId}')
    expect(rail).toContain('command-rail-views')
  })

  it('hides the status-bar Research button while the command rail is active', () => {
    const status = readFileSync(
      `${process.cwd()}/src/components/status-bar/StatusBarSections.tsx`,
      'utf8',
    )
    expect(status).toContain('testId="status-research"')
    expect(status).toContain(
      '{!commandRailActive && onOpenResearch ? <ResearchButton compact={compact} locale={locale} onOpenResearch={onOpenResearch} /> : null}',
    )
  })
})
