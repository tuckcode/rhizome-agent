import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover Stop is click-only', () => {
  it('locks Stop as click-only in the composer foot', () => {
    const foot = readFileSync(
      `${process.cwd()}/src/components/ChatComposerFoot.tsx`,
      'utf8',
    )
    expect(foot).toContain('Stop is click-only')
  })
})
