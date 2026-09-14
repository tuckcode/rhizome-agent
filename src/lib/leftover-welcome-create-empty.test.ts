import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover welcome create empty', () => {
  it('locks onboarding.welcome.createEmpty in WelcomeScreen', () => {
    const welcome = readFileSync(
      `${process.cwd()}/src/components/WelcomeScreen.tsx`,
      'utf8',
    )
    expect(welcome).toContain(
      "translate(locale, 'onboarding.welcome.createEmpty')",
    )
  })
})
