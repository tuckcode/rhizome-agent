import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover empty-vault host poll', () => {
  it('locks subscribe(vaultPath ?? \'\', setStatus) in the hook', () => {
    const hook = readFileSync(
      `${process.cwd()}/src/hooks/usePrimeHostStatus.ts`,
      'utf8',
    )
    expect(hook).toContain("return subscribe(vaultPath ?? '', setStatus)")
  })

  it('locks usePrimeHostStatus(isPrimeTarget, vaultPath) in ChatHome', () => {
    const chatHome = readFileSync(
      `${process.cwd()}/src/components/ChatHome.tsx`,
      'utf8',
    )
    expect(chatHome).toContain('usePrimeHostStatus(isPrimeTarget, vaultPath)')
  })
})
