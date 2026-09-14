import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/docs/plans/handoffs/2026-09-14-1621-c40-leftover-findings.md`,
  'utf8',
)

describe('leftover C40 rhizome_graph_summary', () => {
  it('locks the C40 leftover findings heading', () => {
    expect(source).toContain('C40 — `rhizome_graph_summary` leftover findings')
  })
})
