import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/docs/plans/handoffs/2026-09-14-1622-packaged-app-gap.md`,
  'utf8',
)

describe('leftover packaged 476756c', () => {
  it('locks the leftover 476756c stamp in the packaged-app gap paper', () => {
    expect(source).toContain('leftover **`476756c`**')
  })
})
