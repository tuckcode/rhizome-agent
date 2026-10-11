import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover native Cmd+K send gate', () => {
  it('lets the palette AI prompt send when the Chat engine is native', () => {
    const app = readFileSync(`${process.cwd()}/src/App.tsx`, 'utf8')
    expect(app).toContain(
      "settings.chat_engine === 'native' || aiTargetReady(quickPromptTarget, aiAgentsStatus)",
    )
  })
})
