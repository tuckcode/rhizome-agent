import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover hide helpers', () => {
  it('locks release_helpers_for_hidden_window in lib.rs', () => {
    const rust = readFileSync(`${process.cwd()}/src-tauri/src/lib.rs`, 'utf8')
    expect(rust).toContain('fn release_helpers_for_hidden_window')
  })
})
