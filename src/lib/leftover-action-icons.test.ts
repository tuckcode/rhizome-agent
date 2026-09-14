import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/src/components/AiMessage.tsx`,
  'utf8',
)

describe('leftover Chat action icons', () => {
  it('locks regenerate as an icon action', () => {
    expect(source).toContain('data-testid="ai-message-regenerate"')
  })

  it('locks save to vault as an icon action', () => {
    expect(source).toContain('data-testid="ai-message-save-to-vault"')
  })

  it('locks copy as an icon action', () => {
    expect(source).toContain('data-testid="ai-message-copy"')
  })

  it('locks fork as an icon action', () => {
    expect(source).toContain('data-testid="ai-message-fork"')
  })
})
