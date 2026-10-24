import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover Nous Portal models', () => {
  it('does not call ensure_nous_portal_models from Settings', () => {
    expect(existsSync(`${process.cwd()}/src/components/PrimeProviderStatusSection.tsx`)).toBe(false)
    const settings = readFileSync(`${process.cwd()}/src/components/SettingsPanel.tsx`, 'utf8')
    expect(settings).not.toContain('ensure_nous_portal_models')
    expect(settings).not.toContain('Added ${count} Nous Portal')
  })
})
