import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover identity — Agent not Desktop', () => {
  const identity = readFileSync(
    `${process.cwd()}/docs/IDENTITY.md`,
    'utf8',
  )

  it('locks Agent repo, bundle, and no-Desktop branding', () => {
    expect(identity).toContain('This repository is not Rhizome Desktop.')
    expect(identity).toContain('Do not “fix branding back to Desktop.”')
    expect(identity).toContain(
      'still `tuckcode/rhizome-agent` / `ai.rhizome.agent`',
    )
    expect(identity).toContain(
      'Do **not** add `knispo/rhizome` as `origin`.',
    )
  })
})
