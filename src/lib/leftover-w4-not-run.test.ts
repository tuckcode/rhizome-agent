import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/docs/plans/handoffs/2026-09-14-1620-w4-native-findings.md`,
  'utf8',
)

describe('leftover W4 not run', () => {
  it('locks the W4 findings line that five native God-plan cases were not run', () => {
    expect(source).toContain('W4 five native God-plan cases still NOT RUN')
  })
})
