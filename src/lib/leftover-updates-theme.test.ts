import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover updates + theme', () => {
  it('keeps Check for updates and theme toggle on the status bar, not Contribute', () => {
    const source = readFileSync(
      `${process.cwd()}/src/components/status-bar/StatusBarSections.tsx`,
      'utf8',
    )
    expect(source).toContain(
      '<BuildNumberButton buildNumber={buildNumber} onCheckForUpdates={onCheckForUpdates} compact={compact} locale={locale} />',
    )
    expect(source).toContain('contentTestId="status-theme-mode-tooltip"')
    expect(source).not.toMatch(/Contribute/)
  })
})
