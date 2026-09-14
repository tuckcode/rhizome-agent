import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const host = readFileSync(
  `${process.cwd()}/src-tauri/src/prime_session_host.rs`,
  'utf8',
)

describe('leftover rhizome placeholder name', () => {
  it('locks the placeholder detector', () => {
    expect(host).toContain('fn is_rhizome_placeholder_name')
  })

  it('locks first-message titles and human renames over placeholders', () => {
    expect(host).toContain(
      'titles and human renames still replace this via `is_rhizome_placeholder_name`.',
    )
  })
})
