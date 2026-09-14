import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/src/components/PrimeProviderStatusSection.tsx`,
  'utf8',
)

describe('leftover Nous Portal models', () => {
  it('locks ensure_nous_portal_models host call', () => {
    expect(source).toContain(
      "await callHost<EnsureNousPortalResult>('ensure_nous_portal_models')",
    )
  })

  it('locks Added N Nous Portal models notice', () => {
    expect(source).toContain(
      'Added ${count} Nous Portal ${modelsWord} to the Chat list',
    )
  })
})
