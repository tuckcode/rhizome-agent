import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover Rhizome Vault created toast', () => {
  const source = readFileSync(`${process.cwd()}/src/App.tsx`, 'utf8')

  it('locks Rhizome Vault created and opened at', () => {
    expect(source).toContain('Rhizome Vault created and opened at')
  })

  it('does not use cloned and opened', () => {
    expect(source).not.toContain('vault cloned and opened')
  })
})
