import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover Keep working promote', () => {
  it('locks the Keep working comment and dialog button', () => {
    const close = readFileSync(
      `${process.cwd()}/src/hooks/usePrimeActiveClose.ts`,
      'utf8',
    )
    const dialog = readFileSync(
      `${process.cwd()}/src/components/PrimeActiveCloseDialog.tsx`,
      'utf8',
    )
    expect(close).toContain('Keep working promotes, then detaches.')
    expect(dialog).toContain("t('ai.close.keepWorking')")
  })

  it('promotes through the existing owned-session command', () => {
    const rust = readFileSync(
      `${process.cwd()}/src-tauri/src/prime_session_host.rs`,
      'utf8',
    )
    expect(rust).toContain('"type": "promote_owned_session"')
  })
})
