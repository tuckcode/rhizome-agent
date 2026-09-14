import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/src/components/ChatPreflightBanner.tsx`,
  'utf8',
)

describe('ChatPreflightBanner leftover chrome', () => {
  it('keeps title and body at 12px', () => {
    expect(source).toContain('text-[12px] font-medium text-foreground')
    expect(source).toContain('min-w-0 text-[12px] text-foreground')
    expect(source).not.toMatch(/text-\[11px\]/)
  })

  it('keeps the warning mark amber', () => {
    expect(source).toContain('text-[var(--accent-amber,var(--foreground))]')
  })
})
