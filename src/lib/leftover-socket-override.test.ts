import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover daemon socket override', () => {
  it('locks RHIZOME_PRIME_DAEMON_SOCKET and the override gate', () => {
    const host = readFileSync(
      `${process.cwd()}/src-tauri/src/prime_session_host.rs`,
      'utf8',
    )
    expect(host).toContain(
      'const DAEMON_SOCKET_ENV: &str = "RHIZOME_PRIME_DAEMON_SOCKET"',
    )
    expect(host).toContain('fn daemon_socket_is_overridden()')
  })
})
