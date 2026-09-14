import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover C18 welcome Download words', () => {
  it('locks Download the Getting Started vault on the existing key', () => {
    const en = readFileSync(`${process.cwd()}/src/lib/locales/en.json`, 'utf8')
    expect(en).toContain(
      '"onboarding.welcome.templateDescription": "Download the Getting Started vault"',
    )
  })

  it('reads that key through translate in WelcomeScreen', () => {
    const welcome = readFileSync(
      `${process.cwd()}/src/components/WelcomeScreen.tsx`,
      'utf8',
    )
    expect(welcome).toContain(
      "translate(locale, 'onboarding.welcome.templateDescription')",
    )
  })
})
