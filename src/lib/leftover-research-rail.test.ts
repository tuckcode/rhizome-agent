import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover research rail', () => {
  it('keeps Research on the command rail', () => {
    const rail = readFileSync(
      `${process.cwd()}/src/components/CommandRail.tsx`,
      'utf8',
    )
    expect(rail).toContain("label={t('rail.research')}")
    expect(rail).toContain('testId="command-rail-research"')
  })
})
