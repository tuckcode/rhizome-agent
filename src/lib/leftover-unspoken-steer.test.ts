import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const rust = readFileSync(
  `${process.cwd()}/src-tauri/src/prime_session_host.rs`,
  'utf8',
)

const panel = readFileSync(
  `${process.cwd()}/src/components/AiPanel.tsx`,
  'utf8',
)

describe('leftover unspoken steer extras', () => {
  it('rust host has no quoted first extra', () => {
    expect(rust).not.toMatch(/"set_steering_mode"/)
  })

  it('rust host has no quoted second extra', () => {
    expect(rust).not.toMatch(/"abort_and_clear_queue"/)
  })

  it('AiPanel has no first extra token', () => {
    expect(panel).not.toContain('set_steering_mode')
  })

  it('AiPanel has no second extra token', () => {
    expect(panel).not.toContain('abort_and_clear_queue')
  })
})
