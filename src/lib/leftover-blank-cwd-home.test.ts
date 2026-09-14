import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover blank cwd home', () => {
  it('locks normalize_cwd_falls_back_to_home_for_blank_paths in prime_session_host.rs', () => {
    const host = readFileSync(
      `${process.cwd()}/src-tauri/src/prime_session_host.rs`,
      'utf8',
    )
    expect(host).toContain('normalize_cwd_falls_back_to_home_for_blank_paths')
  })
})
