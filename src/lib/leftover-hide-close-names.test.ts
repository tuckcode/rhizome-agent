import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover hide-close helper names', () => {
  it('locks hide-on-close helper stop names in lib.rs', () => {
    const rust = readFileSync(`${process.cwd()}/src-tauri/src/lib.rs`, 'utf8')
    // Spawned Prime daemon stays warm on hide for fast reopen.
    expect(rust).not.toContain(
      '["spawned_prime_daemon", "ws_bridge", "mindwalk"]',
    )
    expect(rust).toContain('["ws_bridge", "mindwalk"]')
    expect(rust).toContain('hide must leave the spawned Prime daemon warm for fast reopen')
  })
})
