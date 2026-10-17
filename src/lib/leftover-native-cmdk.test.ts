import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover native Cmd+K send gate', () => {
  it('lets the palette AI prompt send when the Chat engine is native', () => {
    const app = readFileSync(`${process.cwd()}/src/App.tsx`, 'utf8')
    expect(app).toContain(
      'chatEngineAllowsSendWithoutPrime(chatEngine) || aiTargetReady(quickPromptTarget, aiAgentsStatus)',
    )
    expect(app).toContain('chatEngine={chatEngine}')
  })

  it('names Cmd+K after the engine running Chat', () => {
    const app = readFileSync(`${process.cwd()}/src/App.tsx`, 'utf8')
    const palette = readFileSync(`${process.cwd()}/src/components/CommandPaletteAiMode.tsx`, 'utf8')
    expect(app).toContain('aiAgentLabel={composerAgentLabel({')
    expect(palette).toContain("t('ai.panel.placeholder.ready', { agent: aiAgentLabel })")
  })
})
