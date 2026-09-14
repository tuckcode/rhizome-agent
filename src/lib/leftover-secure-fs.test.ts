import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover secure_fs owner-only writes', () => {
  it('locks Unix owner-only 0o600 create and comment', () => {
    const fs = readFileSync(
      `${process.cwd()}/src-tauri/src/secure_fs.rs`,
      'utf8',
    )
    expect(fs).toContain('owner-only (`0o600`)')
    expect(fs).toContain('.mode(0o600)')
  })
})
