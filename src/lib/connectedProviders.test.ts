import { describe, expect, it } from 'vitest'
import { createMissingAiAgentsStatus, createAiAgentAvailability } from './aiAgents'
import type { AiModelProvider } from './aiTargets'
import { buildConnectedRows } from './connectedProviders'

const capabilities = {
  streaming: false,
  tools: false,
  vision: null,
  json_mode: false,
  reasoning: { state: 'unknown' as const },
}

function provider(overrides: Partial<AiModelProvider> & Pick<AiModelProvider, 'id' | 'name' | 'kind'>): AiModelProvider {
  return {
    base_url: null,
    api_key_storage: 'local_file',
    models: [{ id: 'm', display_name: 'm', capabilities }],
    ...overrides,
  }
}

describe('buildConnectedRows', () => {
  it('lists agents and providers with Ready, Needs a key, Not running, and Couldn\'t load models', () => {
    const agents = {
      ...createMissingAiAgentsStatus(),
      claude_code: createAiAgentAvailability('installed', '2.1.289 (Claude Code)'),
    }
    const scrub = provider({
      id: 'scrub',
      name: 'Scrub test',
      kind: 'open_ai_compatible',
      base_url: 'https://scrub.example/v1',
    })
    const rows = buildConnectedRows({
      agents,
      providers: [scrub],
      failureFor: (item) => {
        if (item.kind === 'ollama') return 'unreachable'
        if (item.id === 'scrub') return 'timeout'
        if (item.kind === 'lm_studio') return 'empty'
        return null
      },
      modelsFor: (item) => {
        if (item.kind === 'ollama' || item.kind === 'lm_studio' || item.id === 'scrub') return []
        return ['gpt-4o']
      },
    })

    expect(rows.find((row) => row.name === 'Claude Code')).toMatchObject({
      status: 'ready',
      statusLabel: 'Ready',
      action: 'open',
      tab: 'agents',
    })
    expect(rows.find((row) => row.name === 'Codex')).toMatchObject({
      statusLabel: 'Not installed',
      action: 'open',
    })
    expect(rows.find((row) => row.name === 'Ollama')).toMatchObject({
      status: 'not_running',
      statusLabel: 'Not running',
      action: 'retry',
      tab: 'local',
    })
    expect(rows.find((row) => row.name === 'LM Studio')).toMatchObject({
      status: 'load_failed',
      statusLabel: "Couldn't load models",
      action: 'retry',
    })
    expect(rows.find((row) => row.name === 'Scrub test')).toMatchObject({
      status: 'load_failed',
      showKeyField: true,
      tab: 'api',
    })
    expect(rows.find((row) => row.name === 'OpenAI')).toMatchObject({
      status: 'needs_key',
      statusLabel: 'Needs a key',
      action: 'add_key',
      showKeyField: true,
    })
    expect(rows.find((row) => row.name === 'Ready models')).toBeUndefined()
    expect(rows.some((row) => row.name === 'Anthropic')).toBe(false)
    expect(rows.some((row) => row.name === 'Custom provider')).toBe(false)
    expect(rows.some((row) => row.name === 'Prime Agent' || row.name === 'Hermes Agent')).toBe(false)
  })

  it('shows the models a Ready provider gives', () => {
    const rows = buildConnectedRows({
      agents: createMissingAiAgentsStatus(),
      providers: [],
      failureFor: () => null,
      modelsFor: (item) => (item.kind === 'ollama' ? ['llama3.2', 'qwen2.5'] : null),
    })
    expect(rows.find((row) => row.name === 'Ollama')).toMatchObject({
      status: 'ready',
      models: ['llama3.2', 'qwen2.5'],
      action: 'open',
    })
    expect(rows.find((row) => row.name === 'LM Studio')?.status).toBe('load_failed')
  })
})
