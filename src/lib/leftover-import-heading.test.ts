import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/docs/plans/handoffs/2026-09-14-1626-import-jsonl-findings.md`,
  'utf8',
)

describe('leftover import heading', () => {
  it('locks the findings heading that stays vault-only', () => {
    expect(source).toContain('import_jsonl findings — still vault-only until `1`')
  })
})
