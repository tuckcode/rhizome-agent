import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/src-tauri/src/prime_session_host.rs`,
  'utf8',
)

describe('leftover clock-first home session name', () => {
  it('locks the clock-first home-folder session name example', () => {
    expect(source).toContain('Rhizome · Sep 6 · 3:35p · jdoe · f65c06')
  })
})
