import { describe, expect, it } from 'vitest'
import {
  LOCAL_AI_PROVIDER_KINDS,
  agentTargetId,
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
  AI_AGENT_DEFINITIONS,
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
  it('builds selectable targets for every supported coding agent', () => {
    expect(agentTargets().map((target) => target.id)).toEqual(
      AI_AGENT_DEFINITIONS.map((definition) => agentTargetId(definition.id)),
    )
  })

  it('resolves Hermes as a persisted default agent target', () => {
    const target = resolveAiTarget({
      default_ai_agent: 'claude_code',
      default_ai_target: 'agent:hermes',
    } as Settings)

    expect(target).toMatchObject({
      kind: 'agent',
      agent: 'hermes',
      id: 'agent:hermes',
      label: 'Hermes Agent',
    })
  })

  it('accepts legacy agent ids saved in the default target field', () => {
    const target = resolveAiTarget({
      default_ai_agent: 'claude_code',
      default_ai_target: 'kiro',
    } as Settings)

    expect(target).toMatchObject({
      kind: 'agent',
      agent: 'kiro',
      id: 'agent:kiro',
    })
  })

  it('uses the legacy default agent when a saved agent target is stale', () => {
    const target = resolveAiTarget({
      default_ai_agent: 'kiro',
      default_ai_target: 'agent:claude_code',
    } as Settings)

    expect(target).toMatchObject({
      kind: 'agent',
      agent: 'kiro',
      id: 'agent:kiro',
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
  const claudeTarget = agentTargets().find((t) => t.agent === 'claude_code') as AiTarget
  const codexTarget = agentTargets().find((t) => t.agent === 'codex') as AiTarget
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
    const statuses = statusWith({ claude_code: createAiAgentAvailability('installed', '1.0.0') })
    expect(preflightAiTarget(claudeTarget, statuses)).toEqual({ state: 'ready' })
  })

  it('is checking while the agent probe has not resolved yet', () => {
    expect(preflightAiTarget(claudeTarget, createCheckingAiAgentsStatus())).toEqual({ state: 'checking' })
  })

  it('is blocked with install guidance when the resolved agent is missing', () => {
    const statuses = createMissingAiAgentsStatus()
    const result = preflightAiTarget(claudeTarget, statuses)
    expect(result).toEqual({
      state: 'blocked',
      agent: 'claude_code',
      label: getAiAgentDefinition('claude_code').label,
      installUrl: getAiAgentDefinition('claude_code').installUrl,
    })
  })

  it('names the correct agent when a non-default agent is missing', () => {
    const statuses = statusWith({ claude_code: createAiAgentAvailability('installed') })
    const result = preflightAiTarget(codexTarget, statuses)
    expect(result).toMatchObject({ state: 'blocked', agent: 'codex' })
  })

  it('is always ready for a direct API model target, regardless of agent statuses', () => {
    expect(preflightAiTarget(apiModelTarget, createMissingAiAgentsStatus())).toEqual({ state: 'ready' })
  })
})
