import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover reconnect / add key', () => {
  it('keeps provider display names and drops the Prime settings cards', () => {
    expect(existsSync(`${process.cwd()}/src/components/PrimeProviderStatusSection.tsx`)).toBe(false)
    const labels = readFileSync(
      `${process.cwd()}/src/lib/primeProviderLabels.ts`,
      'utf8',
    )
    const settings = readFileSync(`${process.cwd()}/src/components/SettingsPanel.tsx`, 'utf8')
    expect(labels).toContain("anthropic: 'Anthropic'")
    expect(labels).toContain("deepseek: 'DeepSeek'")
    expect(settings).not.toContain('PrimeProviderStatusSection')
    expect(settings).not.toContain('pick models inside Prime')
  })
})
