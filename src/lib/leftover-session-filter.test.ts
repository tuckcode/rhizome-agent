import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/src/lib/primeSessionMeta.ts`,
  'utf8',
)

describe('leftover session filter fields', () => {
  it('locks title / cwd / branch — not transcript', () => {
    expect(source).toContain(
      'const fields = [displayTitle, session.title, session.cwd, session.gitBranch]',
    )
  })
})
