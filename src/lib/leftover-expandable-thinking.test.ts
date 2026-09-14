import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/src/components/AiMessage.tsx`,
  'utf8',
)

describe('leftover expandable thinking', () => {
  it('locks the reasoning toggle test id', () => {
    expect(source).toContain('data-testid="reasoning-toggle"')
  })

  it('locks normalizeReasoningDisplay on the expanded body', () => {
    expect(source).toContain('normalizeReasoningDisplay(text)')
  })
})
