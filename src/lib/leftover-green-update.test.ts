import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover green Rhizome update bar', () => {
  it('keeps Rhizome in-app update chrome, not Prime updater', () => {
    const source = readFileSync(
      `${process.cwd()}/src/components/VersionUpdateIndicator.tsx`,
      'utf8',
    )
    expect(source).toContain("background: 'var(--accent-green)'")
    expect(source).toContain('data-testid="status-version-update"')
    expect(source).toContain('rhizomeActions.startDownload()')
  })
})
