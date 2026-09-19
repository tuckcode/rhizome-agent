import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/src/lib/shellLayout.ts`,
  'utf8',
)

describe('leftover narrow notes', () => {
  it('fits the preset columns to preserve Chat', () => {
    expect(source).toContain('fitPanePreset(preset,')
  })
})
