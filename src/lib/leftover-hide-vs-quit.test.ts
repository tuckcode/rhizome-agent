import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover hide vs quit', () => {
  it('locks hide-on-close vs Cmd+Q quit strings in lib.rs', () => {
    const rust = readFileSync(`${process.cwd()}/src-tauri/src/lib.rs`, 'utf8')
    expect(rust).toContain('fn window_hides_instead_of_closing')
    expect(rust).toContain('Cmd+Q raises `ExitRequested`, not `CloseRequested`')
    expect(rust).toContain('fn focus_main_window')
  })
})
