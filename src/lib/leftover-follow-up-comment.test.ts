import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/src-tauri/src/prime_session_host.rs`,
  'utf8',
)

describe('leftover follow-up comment', () => {
  it('locks the comment that follow-ups default to one-at-a-time', () => {
    expect(source).toContain(
      'set_follow_up_mode` defaults to one-at-a-time',
    )
  })
})
