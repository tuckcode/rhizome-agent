import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/docs/plans/handoffs/2026-09-14-1619-c64-native-findings.md`,
  'utf8',
)

describe('leftover C64 not run', () => {
  it('locks the C64 findings heading that three cold launches were not run', () => {
    expect(source).toContain('Three cold launches — NOT RUN')
  })
})
