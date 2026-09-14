import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/src/components/VaultPanel.tsx`,
  'utf8',
)

describe('VaultPanel leftover restore rail', () => {
  it('keeps the Show Notes label', () => {
    expect(source).toContain("const label = 'Show Notes'")
  })

  it('keeps the restore test id', () => {
    expect(source).toContain('data-testid="vault-panel-restore"')
  })

  it('sizes the restore rail with COMMAND_RAIL_WIDTH_PX', () => {
    expect(source).toContain('width: COMMAND_RAIL_WIDTH_PX,')
    expect(source).toContain('minWidth: COMMAND_RAIL_WIDTH_PX,')
    expect(source).toContain('maxWidth: COMMAND_RAIL_WIDTH_PX,')
  })
})
