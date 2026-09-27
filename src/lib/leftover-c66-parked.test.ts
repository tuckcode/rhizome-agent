import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover C66 parked', () => {
  it('keeps one installation-wide profile in Settings', () => {
    const source = readFileSync(
      `${process.cwd()}/src/components/SettingsPanel.tsx`,
      'utf8',
    )
    expect(source).toContain('settings-agent-profile')
    expect(source).toContain('agent_profile')
  })
})
