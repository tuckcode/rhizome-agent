import { describe, expect, it } from 'vitest'
import { readAppShellSource } from '../test-utils/appShellSource'

describe('leftover Rhizome Vault created toast', () => {
  const source = readAppShellSource()

  it('locks Rhizome Vault created and opened at', () => {
    expect(source).toContain('Rhizome Vault created and opened at')
  })

  it('does not use cloned and opened', () => {
    expect(source).not.toContain('vault cloned and opened')
  })
})
