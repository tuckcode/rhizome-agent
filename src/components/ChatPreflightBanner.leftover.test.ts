import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/src/components/ChatPreflightBanner.tsx`,
  'utf8',
)

describe('ChatPreflightBanner leftover chrome', () => {
  it('keeps the heading distinct from the blocker details', () => {
    expect(source).toMatch(/font-medium text-foreground" data-testid="chat-preflight-title"/)
    expect(source).toContain('text-[var(--text-secondary)]')
  })

  it('keeps the warning mark amber', () => {
    expect(source).toContain('text-[var(--accent-amber,var(--foreground))]')
  })
})
