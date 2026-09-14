import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover reconnect / add key', () => {
  it('locks Anthropic Reconnect and DeepSeek Add key on Settings cards', () => {
    const providers = readFileSync(
      `${process.cwd()}/src/components/PrimeProviderStatusSection.tsx`,
      'utf8',
    )
    expect(providers).toContain("anthropic: 'Anthropic'")
    expect(providers).toContain("deepseek: 'DeepSeek'")
    expect(providers).toContain("connected || provider.expired ? 'Reconnect' : 'Sign in'")
    expect(providers).toContain("return 'Add key'")
  })
})
