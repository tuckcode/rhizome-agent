import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/src/components/AiPanelChrome.tsx`,
  'utf8',
)

describe('leftover queued follow-ups', () => {
  it('keeps composer-queued-follow-ups', () => {
    expect(source).toContain('data-testid="composer-queued-follow-ups"')
  })

  it('keeps queuedLabel', () => {
    expect(source).toContain("t('ai.panel.queuedLabel')")
  })

  it('has no edit-one queue command', () => {
    expect(source).not.toContain('mutate_queued_message')
  })
})
