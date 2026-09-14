import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/src/components/WelcomeScreen.tsx`,
  'utf8',
)

describe('leftover welcome offline', () => {
  it('locks isOffline: boolean', () => {
    expect(source).toContain('isOffline: boolean')
  })

  it('locks { disabled: false, run: onCreateVault }', () => {
    expect(source).toContain('{ disabled: false, run: onCreateVault }')
  })
})
