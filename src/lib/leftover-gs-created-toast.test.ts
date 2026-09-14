import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover Getting Started created toast', () => {
  const source = readFileSync(`${process.cwd()}/src/App.tsx`, 'utf8')

  it('locks Getting Started vault created and opened at', () => {
    expect(source).toContain('Getting Started vault created and opened at')
  })

  it('does not use Getting Started vault cloned and opened', () => {
    expect(source).not.toContain('Getting Started vault cloned and opened')
  })
})
