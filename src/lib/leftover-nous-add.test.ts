import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover Nous Portal add to Chat list', () => {
  it('does not offer Add to Chat list from Settings', () => {
    expect(existsSync(`${process.cwd()}/src/components/PrimeProviderStatusSection.tsx`)).toBe(false)
    const settings = readFileSync(`${process.cwd()}/src/components/SettingsPanel.tsx`, 'utf8')
    expect(settings).not.toContain('Add to Chat list')
    expect(settings).not.toContain('nous-portal')
  })
})
