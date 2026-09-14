import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover hide-on-close cancel', () => {
  it('locks Cancel and Keep working on the active-close dialog', () => {
    const dialog = readFileSync(
      `${process.cwd()}/src/components/PrimeActiveCloseDialog.tsx`,
      'utf8',
    )
    expect(dialog).toContain("t('common.cancel')")
    expect(dialog).toContain("t('ai.close.keepWorking')")
  })
})
