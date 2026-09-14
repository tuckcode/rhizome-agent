import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const host = readFileSync(
  `${process.cwd()}/src-tauri/src/prime_session_host.rs`,
  'utf8',
)

describe('leftover set_session_name at creation', () => {
  it('locks the creation placeholder comment', () => {
    expect(host).toContain(
      'Rhizome seeded a placeholder with `set_session_name` at creation',
    )
  })

  it('locks the attached-session command type', () => {
    expect(host).toContain('"type": "set_session_name"')
  })

  it('locks that Prime only names the attached session', () => {
    expect(host).toContain(
      "Prime's `set_session_name` only addresses the attached session",
    )
  })
})
