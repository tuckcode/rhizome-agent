import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const status = readFileSync(
  `${process.cwd()}/src/components/StatusBar.test.tsx`,
  'utf8',
)
const about = readFileSync(
  `${process.cwd()}/src/components/AboutSettingsSection.tsx`,
  'utf8',
)

describe('leftover contribute about', () => {
  it('locks Contribute and Docs out of the status bar', () => {
    expect(status).toContain('keeps Contribute and Docs out of the status bar')
  })

  it('locks settings-about-docs', () => {
    expect(about).toContain('settings-about-docs')
  })
})
