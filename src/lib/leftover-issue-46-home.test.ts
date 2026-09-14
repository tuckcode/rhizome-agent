import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/docs/plans/handoffs/2026-09-14-1605-issue-46-findings.md`,
  'utf8',
)

describe('leftover issue 46 chat-without-vault home', () => {
  it('locks the #46 findings heading that Chat-without-vault is not MCP HOME scope', () => {
    expect(source).toContain('#46 findings — Chat-without-vault vs MCP HOME scope')
  })
})
