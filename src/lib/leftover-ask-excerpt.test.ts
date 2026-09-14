import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

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
    const app = readFileSync(`${process.cwd()}/src/App.tsx`, 'utf8')
    expect(app).toContain('<AskChatExcerptMenu onAsk={handleAskChatAboutExcerpt}>')
  })
})
