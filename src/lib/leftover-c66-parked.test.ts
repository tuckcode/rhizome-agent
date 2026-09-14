import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover C66 parked', () => {
  it('does not encode an agent-profile store in Settings', () => {
    const source = readFileSync(
      `${process.cwd()}/src/components/SettingsPanel.tsx`,
      'utf8',
    )
    expect(source).not.toMatch(/agentProfile|agent_profile|C66/)
  })
})
