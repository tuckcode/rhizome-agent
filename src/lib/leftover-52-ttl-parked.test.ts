import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover 52 ttl parked', () => {
  it('does not add a Done TTL on the tray', () => {
    const source = readFileSync(
      `${process.cwd()}/src-tauri/src/menu_bar_companion.rs`,
      'utf8',
    )
    expect(source).not.toMatch(/Done TTL|done_ttl|just_finished|just finished/)
  })
})
