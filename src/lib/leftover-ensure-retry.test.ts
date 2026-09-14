import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover ensure retry', () => {
  it('retries ensure_prime_session_host on the status poll when the host is down', () => {
    const host = readFileSync(
      `${process.cwd()}/src/hooks/usePrimeHostStatus.ts`,
      'utf8',
    )
    expect(host).toContain('if (!next.running && vaultPath)')
    expect(host).toContain("await callHost('ensure_prime_session_host', { vaultPath })")
  })
})
