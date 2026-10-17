import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { readAppShellSource } from '../test-utils/appShellSource'

describe('leftover Ask chat excerpt', () => {
  it('locks the excerpt prompt on formatAskChatExcerpt', () => {
    const excerpt = readFileSync(
      `${process.cwd()}/src/components/askChatExcerpt.ts`,
      'utf8',
    )
    expect(excerpt).toContain(
      'Look at this excerpt from “${noteTitle}”:',
    )
  })

  it('locks AskChatExcerptMenu wiring in App', () => {
    const app = readAppShellSource()
    expect(app).toContain('<AskChatExcerptMenu onAsk={handleAskChatAboutExcerpt}>')
  })
})
