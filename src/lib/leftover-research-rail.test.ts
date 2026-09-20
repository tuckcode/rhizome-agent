import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover research rail', () => {
  it('keeps Research off the command rail', () => {
    const rail = readFileSync(
      `${process.cwd()}/src/components/CommandRail.tsx`,
      'utf8',
    )
    expect(rail).not.toContain("label={t('rail.research')}")
    expect(rail).not.toContain('testId="command-rail-research"')
  })

  it('keeps Research on the status bar while the command rail is active', () => {
    const status = readFileSync(
      `${process.cwd()}/src/components/status-bar/StatusBarSections.tsx`,
      'utf8',
    )
    expect(status).toContain('testId="status-research"')
    expect(status).toContain(
      '{onOpenResearch ? <ResearchButton compact={compact} locale={locale} onOpenResearch={onOpenResearch} /> : null}',
    )
  })
})
