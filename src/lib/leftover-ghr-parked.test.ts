import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover ghr parked', () => {
  it('locks scrub_secrets_does_not_yet_cover_ghr_or_stripe_underscore_keys', () => {
    const source = readFileSync(
      `${process.cwd()}/src-tauri/src/telemetry.rs`,
      'utf8',
    )
    expect(source).toContain(
      'scrub_secrets_does_not_yet_cover_ghr_or_stripe_underscore_keys',
    )
  })
})
