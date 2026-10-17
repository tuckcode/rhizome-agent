import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover catalog wait', () => {
  it('does not load a Prime catalog from Settings', () => {
    const panel = readFileSync(
      `${process.cwd()}/src/components/SettingsPanel.tsx`,
      'utf8',
    )
    expect(panel).not.toContain('skip provider IPC until then')
    expect(panel).not.toContain('PrimeProviderStatusSection')
    expect(panel).not.toContain('loadModelCatalog')
  })
})
