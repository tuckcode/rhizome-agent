import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover stop spawned daemon', () => {
  it('locks pub fn stop_spawned_daemon in prime_session_host.rs', () => {
    const host = readFileSync(
      `${process.cwd()}/src-tauri/src/prime_session_host.rs`,
      'utf8',
    )
    expect(host).toContain('pub fn stop_spawned_daemon()')
  })
})
