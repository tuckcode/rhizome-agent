import { describe, expect, it } from 'vitest'
import {
  LOCAL_AI_PROVIDER_KINDS,
  agentTargets,
  aiModelProviderCatalog,
  aiModelProviderCatalogEntry,
  isLocalAiProvider,
  normalizeAiModelProviders,
  preflightAiTarget,
  resolveAiTarget,
  type AiModelProvider,
  type AiTarget,
} from './aiTargets'
import {
  createAiAgentAvailability,
  createCheckingAiAgentsStatus,
  createMissingAiAgentsStatus,
  getAiAgentDefinition,
  type AiAgentsStatus,
} from './aiAgents'
import type { Settings } from '../types'

function provider(kind: AiModelProvider['kind']): AiModelProvider {
  return {
    id: ' Demo ',
    name: ' Demo Provider ',
    kind,
    base_url: ' https://example.com/v1 ',
    api_key_storage: null,
    api_key_env_var: ' DEMO_API_KEY ',
    headers: null,
    models: [{
      id: ' demo-model ',
      display_name: ' Demo Model ',
      context_window: null,
      max_output_tokens: null,
      capabilities: {
        streaming: true,
        tools: false,
        vision: false,
        json_mode: true,
        reasoning: false,
      },
    }],
  }
}

describe('ai target provider contract', () => {
  it('builds selectable targets for product-visible agents only (Prime)', () => {
    expect(agentTargets().map((target) => target.id)).toEqual(['agent:prime'])
  })

  it('resolves Prime as the default agent target', () => {
    const target = resolveAiTarget({
      default_ai_agent: 'prime',
      default_ai_target: 'agent:prime',
    } as Settings)

    expect(target).toMatchObject({
      kind: 'agent',
      agent: 'prime',
      id: 'agent:prime',
      label: 'Prime Agent',
    })
  })

  it('falls back to Prime when a legacy agent id is saved as the default target', () => {
    const target = resolveAiTarget({
      default_ai_agent: 'prime',
      default_ai_target: 'kiro',
    } as Settings)

    expect(target).toMatchObject({
      kind: 'agent',
      agent: 'prime',
      id: 'agent:prime',
    })
  })

  it('uses Prime when a non-product legacy default agent is stored', () => {
    const target = resolveAiTarget({
      default_ai_agent: 'kiro',
      default_ai_target: 'agent:prime',
    } as Settings)

    expect(target).toMatchObject({
      kind: 'agent',
      agent: 'prime',
      id: 'agent:prime',
    })
  })

  it('keeps provider defaults in one catalog with stable grouping metadata', () => {
    const entries = aiModelProviderCatalog()
    const kinds = entries.map((entry) => entry.kind)

    expect(kinds).toEqual([
      'ollama',
      'lm_studio',
      'open_ai',
      'anthropic',
      'gemini',
      'open_router',
      'open_ai_compatible',
    ])
    expect(new Set(kinds).size).toBe(kinds.length)
    expect(LOCAL_AI_PROVIDER_KINDS).toEqual(['ollama', 'lm_studio'])
    expect(aiModelProviderCatalogEntry('anthropic')).toMatchObject({
      name: 'Anthropic',
      base_url: 'https://api.anthropic.com/v1',
      api_key_storage: 'local_file',
      api_key_env_var: 'ANTHROPIC_API_KEY',
      default_model_id: 'claude-3-5-sonnet-latest',
      local: false,
    })
    expect(aiModelProviderCatalogEntry('open_ai_compatible')).toMatchObject({
      base_url: 'https://api.example.com/v1',
      api_key_env_var: 'OPENAI_API_KEY',
      local: false,
    })
  })

  it('normalizes saved providers while using the catalog for local/provider classification', () => {
    const normalized = normalizeAiModelProviders([
      provider('open_ai_compatible'),
      { ...provider('ollama'), id: ' ', name: 'Missing ID' },
    ])

    expect(normalized).toHaveLength(1)
    expect(normalized[0]).toMatchObject({
      id: 'demo',
      name: 'Demo Provider',
      base_url: 'https://example.com/v1',
      api_key_env_var: 'DEMO_API_KEY',
      api_key_storage: 'env',
    })
    expect(normalized[0].models[0]).toMatchObject({
      id: 'demo-model',
      display_name: 'Demo Model',
    })
    expect(isLocalAiProvider(provider('lm_studio'))).toBe(true)
    expect(isLocalAiProvider(provider('open_router'))).toBe(false)
  })
})

describe('preflightAiTarget', () => {
  const primeTarget = agentTargets().find((t) => t.agent === 'prime') as AiTarget
  // Legacy backend not in product picker — still valid for preflight of a forced target.
  const codexTarget: AiTarget = {
    kind: 'agent',
    agent: 'codex',
    id: 'agent:codex',
    label: getAiAgentDefinition('codex').label,
    shortLabel: getAiAgentDefinition('codex').shortLabel,
  }
  const apiModelTarget: AiTarget = {
    kind: 'api_model',
    provider: provider('anthropic'),
    model: provider('anthropic').models[0],
    id: 'model:demo/demo-model',
    label: 'Demo Provider · Demo Model',
    shortLabel: 'Demo Model',
  }

  function statusWith(overrides: Partial<AiAgentsStatus>): AiAgentsStatus {
    return { ...createMissingAiAgentsStatus(), ...overrides }
  }

  it('is ready when the resolved agent is installed', () => {
    const statuses = statusWith({ prime: createAiAgentAvailability('installed', '1.0.0') })
    expect(preflightAiTarget(primeTarget, statuses)).toEqual({ state: 'ready' })
  })

  it('is checking while the agent probe has not resolved yet', () => {
    expect(preflightAiTarget(primeTarget, createCheckingAiAgentsStatus())).toEqual({ state: 'checking' })
  })

  it('is blocked with install guidance when the resolved agent is missing', () => {
    const statuses = createMissingAiAgentsStatus()
    const result = preflightAiTarget(primeTarget, statuses)
    expect(result).toEqual({
      state: 'blocked',
      agent: 'prime',
      label: getAiAgentDefinition('prime').label,
      installUrl: getAiAgentDefinition('prime').installUrl,
    })
  })

  it('names the correct agent when a non-default agent is missing', () => {
    const statuses = statusWith({ prime: createAiAgentAvailability('installed') })
    const result = preflightAiTarget(codexTarget, statuses)
    expect(result).toMatchObject({ state: 'blocked', agent: 'codex' })
  })

  it('is always ready for a direct API model target, regardless of agent statuses', () => {
    expect(preflightAiTarget(apiModelTarget, createMissingAiAgentsStatus())).toEqual({ state: 'ready' })
  })
})
