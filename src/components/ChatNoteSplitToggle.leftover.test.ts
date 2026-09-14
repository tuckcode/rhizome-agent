import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/src/components/ChatNoteSplitToggle.tsx`,
  'utf8',
)

describe('ChatNoteSplitToggle leftover', () => {
  it('keeps the On top label', () => {
    expect(source).toContain("label: 'On top'")
  })

  it('keeps the Beside label', () => {
    expect(source).toContain("label: 'Beside'")
  })

  it('keeps the split toggle test id', () => {
    expect(source).toContain('data-testid="chat-note-split-toggle"')
  })

  it('keeps the layout aria-label', () => {
    expect(source).toContain('aria-label="Note and Chat layout"')
  })
})
