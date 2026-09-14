import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover catalog wait', () => {
  it('skips provider IPC until the Agents tab loads the catalog', () => {
    const panel = readFileSync(
      `${process.cwd()}/src/components/SettingsPanel.tsx`,
      'utf8',
    )
    expect(panel).toContain('skip provider IPC until then')
    expect(panel).toContain(
      '{loadModelCatalog ? <PrimeProviderStatusSection t={t} /> : null}',
    )
  })
})
