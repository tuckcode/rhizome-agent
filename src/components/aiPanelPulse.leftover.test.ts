import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/src/components/aiPanelPulse.ts`,
  'utf8',
)
const css = readFileSync(`${process.cwd()}/src/index.css`, 'utf8')

describe('aiPanelPulse leftover', () => {
  it('keeps the running-turn border still (ADR-0193)', () => {
    expect(source).not.toContain('ai-border-pulse')
    expect(css).not.toContain('@keyframes ai-border-pulse')
  })
})
