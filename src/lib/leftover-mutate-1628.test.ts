import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/docs/plans/handoffs/2026-09-14-1628-mutate-queue-findings.md`,
  'utf8',
)

describe('leftover 1628 queue findings', () => {
  it('locks the 16:28 findings heading', () => {
    expect(source).toContain(
      '`mutate_queued_message` findings — 2026-09-14 16:28',
    )
  })
})
