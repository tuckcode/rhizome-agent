import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover picker contrast', () => {
  it('keeps provider labels on text-primary for scroll contrast', () => {
    const picker = readFileSync(
      `${process.cwd()}/src/components/PrimeModelPicker.tsx`,
      'utf8',
    )
    expect(picker).toContain(
      "const PROVIDER_LABEL_CLASS = 'font-mono text-[10px] uppercase tracking-[0.1em] text-primary'",
    )
  })
})
