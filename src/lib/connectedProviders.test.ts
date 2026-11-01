import { describe, expect, it } from 'vitest'
import { createMissingAiAgentsStatus, createAiAgentAvailability } from './aiAgents'
import type { AiModelProvider } from './aiTargets'
import { buildConnectedRows } from './connectedProviders'
import type { OauthStatus } from './providerOauth'

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

function signedIn(email = 'user@example.com'): OauthStatus {
  return {
    provider: 'openai',
    enabled: true,
    signed_in: true,
    usable: true,
    email,
    revoked: true,
  }
}

describe('buildConnectedRows', () => {
  it('lists accounts, providers, and agents without Claude Code, Not installed last', () => {
    const agents = {
      ...createMissingAiAgentsStatus(),
      claude_code: createAiAgentAvailability('installed', '2.1.289 (Claude Code)'),
      codex: createAiAgentAvailability('installed', 'codex'),
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

    expect(rows.find((row) => row.name === 'Claude Code')).toBeUndefined()
    expect(rows.find((row) => row.name === 'ChatGPT')).toMatchObject({
      kind: 'account',
      section: 'accounts',
      statusLabel: 'Needs sign-in',
    })
    expect(rows.find((row) => row.name === 'Codex')).toMatchObject({
      status: 'ready',
      statusLabel: 'Ready',
      action: 'open',
      tab: 'agents',
    })
    expect(rows.find((row) => row.name === 'OpenCode')).toMatchObject({
      statusLabel: 'Not installed',
      action: 'install',
      section: 'not_installed',
    })
    expect(rows.find((row) => row.name === 'Ollama')).toMatchObject({
      status: 'not_running',
      statusLabel: 'Not running',
      action: 'retry',
      tab: 'local',
      section: 'local',
    })
    expect(rows.find((row) => row.name === 'LM Studio')).toMatchObject({
      status: 'no_models',
      statusLabel: 'No models found',
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
      section: 'api_keys',
    })
    expect(rows.some((row) => row.name === 'Anthropic')).toBe(false)
    expect(rows.some((row) => row.name === 'Custom provider')).toBe(false)
    expect(rows.some((row) => row.name === 'Prime Agent' || row.name === 'Hermes Agent')).toBe(false)

    expect(rows.find((row) => row.name === 'Taproot')).toMatchObject({
      section: 'free',
      status: 'ready',
      action: 'open',
      tab: 'api',
      targetRowId: 'free-tier-settings',
      models: ['Taproot'],
    })

    const names = rows.map((row) => row.name)
    const chatgpt = names.indexOf('ChatGPT')
    const openai = names.indexOf('OpenAI')
    const ollama = names.indexOf('Ollama')
    const free = names.indexOf('Taproot')
    const notInstalled = names.indexOf('OpenCode')
    expect(chatgpt).toBeLessThan(openai)
    expect(openai).toBeLessThan(ollama)
    expect(ollama).toBeLessThan(free)
    expect(free).toBeLessThan(notInstalled)
    expect(names.indexOf('Codex')).toBeLessThan(notInstalled)
  })

  it('shows the signed-in ChatGPT email when oauth is ready', () => {
    const rows = buildConnectedRows({
      agents: createMissingAiAgentsStatus(),
      providers: [],
      failureFor: () => null,
      modelsFor: () => null,
      oauthByProvider: { openai: signedIn('plus@example.com') },
    })
    expect(rows.find((row) => row.name === 'ChatGPT')).toMatchObject({
      status: 'ready',
      statusLabel: 'Ready',
      accountEmail: 'plus@example.com',
    })
  })

  it('lists gpt models on the Ready ChatGPT Connected row', () => {
    const openai = provider({
      id: 'openai',
      name: 'OpenAI',
      kind: 'open_ai',
      base_url: 'https://api.openai.com/v1',
      models: [{ id: 'gpt-4.1-mini', display_name: 'gpt-4.1-mini', capabilities }],
    })
    const rows = buildConnectedRows({
      agents: createMissingAiAgentsStatus(),
      providers: [openai],
      failureFor: () => null,
      modelsFor: (item) => (item.kind === 'open_ai' ? ['gpt-4.1-mini', 'gpt-4o'] : null),
      oauthByProvider: { openai: signedIn('plus@example.com') },
    })
    expect(rows.find((row) => row.name === 'ChatGPT')).toMatchObject({
      status: 'ready',
      models: ['gpt-4.1-mini', 'gpt-4o'],
    })
  })

  it('includes a Free Taproot row that opens FreeTierSettings', () => {
    const rows = buildConnectedRows({
      agents: createMissingAiAgentsStatus(),
      providers: [],
      failureFor: () => null,
      modelsFor: () => null,
    })
    expect(rows.find((row) => row.id === 'provider:free_tier')).toMatchObject({
      name: 'Taproot',
      section: 'free',
      status: 'ready',
      action: 'open',
      tab: 'api',
      targetRowId: 'free-tier-settings',
    })
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
    expect(rows.find((row) => row.name === 'LM Studio')?.status).toBe('checking')
  })

  it('marks a configured Anthropic provider Ready with its saved models', () => {
    const claude = provider({
      id: 'work-claude',
      name: 'Work Claude',
      kind: 'anthropic',
      api_key_storage: 'local_file',
      models: [{ id: 'claude-sonnet', display_name: 'Claude Sonnet', capabilities }],
    })
    const rows = buildConnectedRows({
      agents: createMissingAiAgentsStatus(),
      providers: [claude],
      failureFor: () => null,
      modelsFor: () => null,
    })
    expect(rows.find((row) => row.name === 'Work Claude')).toMatchObject({
      status: 'ready',
      statusLabel: 'Ready',
      models: ['Claude Sonnet'],
      action: 'open',
    })
  })

  it('marks a configured keyless remote provider Ready with its saved models', () => {
    const lab = provider({
      id: 'lab',
      name: 'Lab',
      kind: 'open_ai_compatible',
      base_url: 'https://lab.example/v1',
      api_key_storage: 'none',
      api_key_env_var: null,
      models: [{ id: 'lab-1', display_name: 'Lab 1', capabilities }],
    })
    const rows = buildConnectedRows({
      agents: createMissingAiAgentsStatus(),
      providers: [lab],
      failureFor: () => null,
      modelsFor: () => null,
    })
    expect(rows.find((row) => row.name === 'Lab')).toMatchObject({
      status: 'ready',
      statusLabel: 'Ready',
      models: ['Lab 1'],
    })
    expect(rows.find((row) => row.name === 'Lab')?.status).not.toBe('checking')
  })
})
