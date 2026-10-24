import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover allow list', () => {
  it('does not keep a Prime chat model menu in Settings', () => {
    expect(existsSync(`${process.cwd()}/src/components/PrimeModelAllowListSection.tsx`)).toBe(false)
    const settings = readFileSync(`${process.cwd()}/src/components/SettingsPanel.tsx`, 'utf8')
    expect(settings).not.toContain('Chat model menu')
    expect(settings).not.toContain("Choose which of Prime's models appear in the chat model menu")
    expect(settings).not.toContain('pick models inside Prime')
  })
})
