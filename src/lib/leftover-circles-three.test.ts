import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const mycelium = readFileSync(
  `${process.cwd()}/src/components/MyceliumView.tsx`,
  'utf8',
)
const subhead = readFileSync(
  `${process.cwd()}/src/components/PrimeSessionSubhead.tsx`,
  'utf8',
)

describe('leftover CirclesThree footprint', () => {
  it('keeps CirclesThree on MyceliumView', () => {
    expect(mycelium).toContain('CirclesThree')
  })

  it('keeps the Prime session footprint chip', () => {
    expect(subhead).toContain('data-testid="prime-session-footprint"')
    expect(subhead).toContain("title={t('mycelium.title')}")
  })
})
