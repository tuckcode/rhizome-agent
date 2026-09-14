import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover PR #66 keep — still do not merge', () => {
  const source = readFileSync(
    `${process.cwd()}/docs/plans/pr-66-supersession.md`,
    'utf8',
  )

  it('locks KEEP prose already landed and the draft stay-unmerged', () => {
    expect(source).toContain('Still do not merge')
    expect(source).toContain('not a merge')
  })
})
