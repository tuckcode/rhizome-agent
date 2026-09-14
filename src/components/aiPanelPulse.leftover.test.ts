import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/src/components/aiPanelPulse.ts`,
  'utf8',
)

describe('aiPanelPulse leftover', () => {
  it('keeps the running-turn pulse at 2s ease-in-out infinite', () => {
    expect(source).toContain('ai-border-pulse 2s ease-in-out infinite')
  })
})
