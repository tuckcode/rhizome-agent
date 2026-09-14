import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover status vault', () => {
  it('keeps the vault dropdown on StatusBarPrimarySection via vaultPath', () => {
    const source = readFileSync(
      `${process.cwd()}/src/components/status-bar/StatusBarSections.tsx`,
      'utf8',
    )
    expect(source).toContain('export function StatusBarPrimarySection')
    expect(source).toContain('vaultPath')
    expect(source).toContain('<VaultMenu')
    expect(source).toContain('vaultPath={vaultPath}')
  })
})
