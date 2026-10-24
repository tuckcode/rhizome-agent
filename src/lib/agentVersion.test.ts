import { describe, expect, it } from 'vitest'
import { formatLastChecked, normalizeAgentVersion } from './agentVersion'

describe('normalizeAgentVersion', () => {
  it('drops the repeated agent name and adds a v prefix', () => {
    expect(normalizeAgentVersion('2.1.289 (Claude Code)', 'Claude Code')).toBe('v2.1.289')
    expect(normalizeAgentVersion('codex-cli 0.157.1', 'Codex')).toBe('v0.157.1')
  })

  it('keeps a version that is already prefixed', () => {
    expect(normalizeAgentVersion('v0.157.1', 'Codex')).toBe('v0.157.1')
  })

  it('returns null when the probe has no version', () => {
    expect(normalizeAgentVersion(null, 'Kiro')).toBeNull()
    expect(normalizeAgentVersion('   ', 'Kiro')).toBeNull()
  })
})

describe('formatLastChecked', () => {
  it('says just now, one minute, and several minutes', () => {
    const now = 1_700_000_000_000
    expect(formatLastChecked(now - 20_000, now)).toBe('Last checked just now')
    expect(formatLastChecked(now - 60_000, now)).toBe('Last checked 1 min ago')
    expect(formatLastChecked(now - 2 * 60_000, now)).toBe('Last checked 2 min ago')
  })
})
