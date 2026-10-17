import { describe, expect, it } from 'vitest'
import { createAiAgentAvailability, createMissingAiAgentsStatus } from './aiAgents'
import { chatEngineForResolvedTarget, quickPromptTargetIsReady, usesNativeChatStream } from './chatTargetRouting'
import type { AiTarget } from './aiTargets'

const primeTarget: AiTarget = {
  kind: 'agent',
  agent: 'prime',
  id: 'agent:prime',
  label: 'Prime Agent',
  shortLabel: 'Prime',
}

const codexTarget: AiTarget = {
  kind: 'agent',
  agent: 'codex',
  id: 'agent:codex',
  label: 'Codex',
  shortLabel: 'Codex',
}

const claudeTarget: AiTarget = {
  kind: 'agent',
  agent: 'claude_code',
  id: 'agent:claude_code',
  label: 'Claude Code',
  shortLabel: 'Claude',
}

const hermesTarget: AiTarget = {
  kind: 'agent',
  agent: 'hermes',
  id: 'agent:hermes',
  label: 'Hermes Agent',
  shortLabel: 'Hermes',
}

const apiTarget: AiTarget = {
  kind: 'api_model',
  id: 'model:openai/gpt-4.1',
  label: 'OpenAI · GPT-4.1',
  shortLabel: 'GPT-4.1',
  provider: {
    id: 'openai',
    name: 'OpenAI',
    kind: 'open_ai',
    models: [],
  },
  model: {
    id: 'gpt-4.1',
    capabilities: {
      streaming: true,
      tools: true,
      vision: false,
      json_mode: false,
      reasoning: { state: 'unknown' as const },
    },
  },
}

describe('chat target routing', () => {
  it('resolves Prime and Hermes targets to native even before the engine loads', () => {
    expect(chatEngineForResolvedTarget(primeTarget, 'native')).toBe('native')
    expect(chatEngineForResolvedTarget(primeTarget, 'prime')).toBe('native')
    expect(chatEngineForResolvedTarget(primeTarget, undefined)).toBe('native')
    expect(chatEngineForResolvedTarget(hermesTarget, undefined)).toBe('native')
    expect(chatEngineForResolvedTarget(hermesTarget, 'prime')).toBe('native')
    expect(chatEngineForResolvedTarget(codexTarget, 'native')).toBeUndefined()
    expect(chatEngineForResolvedTarget(claudeTarget, 'native')).toBeUndefined()
    expect(chatEngineForResolvedTarget(apiTarget, 'native')).toBeUndefined()
  })

  it('does not call Codex ready just because the Chat engine is native', () => {
    const statuses = createMissingAiAgentsStatus()
    statuses.codex = createAiAgentAvailability('missing', null)
    statuses.prime = createAiAgentAvailability('missing', null)
    expect(quickPromptTargetIsReady(codexTarget, 'native', statuses)).toBe(false)
    expect(quickPromptTargetIsReady(primeTarget, 'native', statuses)).toBe(true)
    expect(quickPromptTargetIsReady(primeTarget, undefined, statuses)).toBe(true)
    expect(quickPromptTargetIsReady(hermesTarget, undefined, statuses)).toBe(true)
  })

  it('streams native only when the resolved target is not an external CLI', () => {
    expect(usesNativeChatStream(primeTarget, 'prime', 'native')).toBe(true)
    expect(usesNativeChatStream(primeTarget, 'prime', undefined)).toBe(true)
    expect(usesNativeChatStream(hermesTarget, 'hermes', undefined)).toBe(true)
    expect(usesNativeChatStream(codexTarget, 'codex', 'native')).toBe(false)
    expect(usesNativeChatStream(claudeTarget, 'claude_code', 'native')).toBe(false)
    expect(usesNativeChatStream(apiTarget, 'prime', 'native')).toBe(false)
    expect(usesNativeChatStream(undefined, 'codex', 'native')).toBe(false)
    expect(usesNativeChatStream(undefined, 'prime', 'native')).toBe(true)
    expect(usesNativeChatStream(undefined, 'prime', undefined)).toBe(true)
  })
})
