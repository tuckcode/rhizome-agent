import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const ai = readFileSync(
  `${process.cwd()}/src-tauri/src/commands/ai.rs`,
  'utf8',
)
const host = readFileSync(
  `${process.cwd()}/src-tauri/src/prime_session_host.rs`,
  'utf8',
)

describe('leftover rename_saved_session', () => {
  it('locks Speaks rename_saved_session on the list command', () => {
    expect(ai).toContain('Speaks `rename_saved_session`')
  })

  it('locks the daemon command type', () => {
    expect(host).toContain('"type": "rename_saved_session"')
  })
})
