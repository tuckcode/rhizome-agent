import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/docs/plans/handoffs/2026-09-14-1620-w4-native-findings.md`,
  'utf8',
)

describe('leftover do not close 41', () => {
  it('locks the W4 native finding that #41 stays open', () => {
    expect(source).toContain('Do not close #41.')
  })
})
