import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const host = readFileSync(
  `${process.cwd()}/src-tauri/src/prime_session_host.rs`,
  'utf8',
)

describe('leftover client_owned session create', () => {
  it('locks create to send lifecycle client_owned', () => {
    expect(host).toContain('"lifecycle": "client_owned"')
  })
})
