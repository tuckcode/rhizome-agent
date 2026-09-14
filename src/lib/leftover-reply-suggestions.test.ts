import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/src/components/AiPanelChrome.tsx`,
  'utf8',
)

describe('leftover reply suggestions', () => {
  it('keeps composer-reply-suggestions', () => {
    expect(source).toContain('data-testid="composer-reply-suggestions"')
  })

  it('keeps options-kind gate', () => {
    expect(source).toContain("suggestion.kind !== 'options'")
  })
})
