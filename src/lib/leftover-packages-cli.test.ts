import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/src/components/PrimeExtensionsSection.tsx`,
  'utf8',
)

describe('leftover packages CLI install', () => {
  it('locks prime-agent package install then reload', () => {
    expect(source).toContain(
      'Install runs `prime-agent package install` in the background, then reloads',
    )
  })
})
