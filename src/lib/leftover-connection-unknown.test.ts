import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/docs/plans/handoffs/2026-09-14-1225-cursor-grok-4-6-d3-status.md`,
  'utf8',
)

describe('leftover connection unknown', () => {
  it('locks Connection unknown as a not-invented host state', () => {
    expect(source).toContain('Connection unknown')
  })

  it('locks no Chat error banner on mid-turn transport failed', () => {
    expect(source).toContain('no Chat error banner')
  })
})
