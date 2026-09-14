import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/src/components/AiMessage.tsx`,
  'utf8',
)

describe('AiMessage leftover', () => {
  it('keeps message-timestamp', () => {
    expect(source).toContain('data-testid="message-timestamp"')
  })

  it('keeps latest-assistant-reply-marker', () => {
    expect(source).toContain('data-testid="latest-assistant-reply-marker"')
  })

  it('keeps accent-green reply marker', () => {
    expect(source).toContain('bg-[var(--accent-green)]')
  })
})
