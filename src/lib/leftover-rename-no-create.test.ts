import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/src/components/PrimeSessionList.tsx`,
  'utf8',
)

describe('leftover rename does not create', () => {
  it('locks list rename to rename_prime_session', () => {
    expect(source).toContain(
      "await call('rename_prime_session', { path: session.path, name })",
    )
  })

  it('does not create a session from rename', () => {
    expect(source).not.toMatch(/create_prime_session|new_prime_session/)
  })
})
