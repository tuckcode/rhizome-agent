import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover native Cmd+K send gate', () => {
  it('lets the palette AI prompt send when the Chat engine is native', () => {
    const app = readFileSync(`${process.cwd()}/src/App.tsx`, 'utf8')
    expect(app).toContain(
      'quickPromptTargetIsReady(quickPromptTarget, chatEngine, aiAgentsStatus)',
    )
    expect(app).toContain('chatEngine: chatEngineForResolvedTarget(quickPromptTarget, chatEngine)')
    expect(app).toContain('chatEngine={chatEngine}')
    expect(app).toContain('chatEngine={settingsLoaded ? chatEngine : undefined}')
    expect(app).toContain('nativeTarget={settingsLoaded ? settings.native_chat_target ?? undefined : undefined}')
    const windowApp = readFileSync(`${process.cwd()}/src/components/AiWorkspaceWindowApp.tsx`, 'utf8')
    expect(windowApp).toContain('chatEngine={settingsLoaded ? chatEngineFromSettings(settings) : undefined}')
    expect(windowApp).toContain('nativeTarget={settingsLoaded ? settings.native_chat_target ?? undefined : undefined}')
  })

  it('names Cmd+K after the engine running Chat', () => {
    const app = readFileSync(`${process.cwd()}/src/App.tsx`, 'utf8')
    const palette = readFileSync(`${process.cwd()}/src/components/CommandPaletteAiMode.tsx`, 'utf8')
    expect(app).toContain('aiAgentLabel={composerAgentLabel({')
    expect(palette).toContain("t('ai.panel.placeholder.ready', { agent: aiAgentLabel })")
  })
})
