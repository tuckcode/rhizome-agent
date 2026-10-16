import { describe, expect, it, vi } from 'vitest'
import type { AiModelProvider } from './aiTargets'
import {
  filterRhizomeChatModels,
  groupRhizomeChatModels,
  includeRemovedProviderModel,
  isWellFormedRhizomeTarget,
  loadRhizomeChatModels,
  REMOVED_PROVIDER_ERROR,
  REMOVED_PROVIDER_LABEL,
  resolveRhizomeChatModel,
  rhizomeModelVisibleName,
  rhizomeProviderNeedsApiKey,
  seedRhizomeChatModels,
  excludeKeylessRhizomeModels,
  countKeylessRhizomeProviders,
} from './rhizomeChatModels'

vi.mock('./callHost', () => ({
  callHost: vi.fn(async (cmd: string, args?: { provider?: { kind?: string } }) => {
    if (cmd !== 'discover_ai_models') throw new Error(`unexpected ${cmd}`)
    if (args?.provider?.kind === 'ollama') return ['llama3.2', 'qwen2.5']
    throw new Error('provider offline')
  }),
}))

const capabilities = {
  streaming: true,
  tools: true,
  vision: true,
  json_mode: true,
  reasoning: false,
}

const configured: AiModelProvider[] = [
  {
    id: 'work-openai',
    name: 'Work OpenAI',
    kind: 'open_ai',
    base_url: 'https://api.openai.com/v1',
    api_key_storage: 'local_file',
    models: [
      {
        id: 'gpt-4o',
        display_name: 'GPT-4o',
        capabilities,
      },
    ],
  },
  {
    id: 'home-openai',
    name: 'Home OpenAI',
    kind: 'open_ai',
    base_url: 'https://home.example/v1',
    api_key_storage: 'local_file',
    models: [
      {
        id: 'gpt-4o',
        display_name: 'Home GPT-4o',
        capabilities,
      },
    ],
  },
]

describe('seedRhizomeChatModels', () => {
  it('lists catalog defaults, configured models, and Free tier, and hides Anthropic', () => {
    const listed = seedRhizomeChatModels(configured)
    expect(listed.some((model) => model.id === 'ollama/llama3.2')).toBe(true)
    expect(listed.some((model) => model.id === 'open_ai/gpt-4.1-mini')).toBe(true)
    expect(listed.some((model) => model.id === 'work-openai/gpt-4o')).toBe(true)
    expect(listed.some((model) => model.id === 'home-openai/gpt-4o')).toBe(true)
    expect(listed.some((model) => model.id === 'free_tier_auto')).toBe(true)
    expect(listed.some((model) => model.id.startsWith('anthropic/'))).toBe(false)
    expect(listed.at(-1)?.id).toBe('free_tier_auto')
    expect(listed.find((model) => model.id === 'work-openai/gpt-4o')?.displayName).toBe('GPT-4o')
    expect(rhizomeModelVisibleName(listed.at(-1)!)).toBe('Free tier (auto)')
  })

  it('lists OpenRouter Claude models and still hides Anthropic and Claude Code', () => {
    const listed = seedRhizomeChatModels([
      {
        id: 'home-openrouter',
        name: 'Home OpenRouter',
        kind: 'open_router',
        base_url: 'https://openrouter.ai/api/v1',
        api_key_storage: 'local_file',
        models: [
          {
            id: 'anthropic/claude-sonnet-4',
            display_name: 'Claude Sonnet 4',
            capabilities,
          },
        ],
      },
      {
        id: 'work-anthropic',
        name: 'Work Anthropic',
        kind: 'anthropic',
        base_url: 'https://api.anthropic.com/v1',
        api_key_storage: 'local_file',
        models: [
          {
            id: 'claude-sonnet-4',
            display_name: 'Claude Sonnet 4',
            capabilities,
          },
        ],
      },
    ])
    expect(listed.some((model) => model.id === 'home-openrouter/anthropic/claude-sonnet-4')).toBe(true)
    expect(listed.some((model) => model.id.startsWith('anthropic/'))).toBe(false)
    expect(listed.some((model) => model.providerKind === 'anthropic')).toBe(false)
    expect(listed.some((model) => model.id.startsWith('claude_code/'))).toBe(false)
  })

  it('never returns an empty list', () => {
    expect(seedRhizomeChatModels([]).length).toBeGreaterThan(0)
    expect(seedRhizomeChatModels(null).length).toBeGreaterThan(0)
  })
})

describe('group and filter', () => {
  it('groups by provider name and filters across label and id', () => {
    const listed = seedRhizomeChatModels(configured)
    const groups = groupRhizomeChatModels(listed)
    expect(groups.some((group) => group.provider === 'OpenAI')).toBe(true)
    expect(groups.some((group) => group.provider === 'Work OpenAI')).toBe(true)
    expect(filterRhizomeChatModels(listed, 'gpt-4o').map((model) => model.id)).toEqual(
      expect.arrayContaining(['work-openai/gpt-4o', 'home-openai/gpt-4o']),
    )
  })
})

describe('isWellFormedRhizomeTarget', () => {
  it('accepts catalog ids and Free tier, and refuses Anthropic', () => {
    expect(isWellFormedRhizomeTarget('work-openai/gpt-4o')).toBe(true)
    expect(isWellFormedRhizomeTarget('open_ai/gpt-4o')).toBe(true)
    expect(isWellFormedRhizomeTarget('free_tier_auto')).toBe(true)
    expect(isWellFormedRhizomeTarget('anthropic/claude-opus-4')).toBe(false)
    expect(isWellFormedRhizomeTarget('claude_code/claude-opus-4')).toBe(false)
    expect(isWellFormedRhizomeTarget('open_router/anthropic/claude-sonnet-4')).toBe(true)
    expect(
      isWellFormedRhizomeTarget('work-anthropic/claude-sonnet-4', [
        {
          id: 'work-anthropic',
          name: 'Work Anthropic',
          kind: 'anthropic',
          base_url: 'https://api.anthropic.com/v1',
          api_key_storage: 'local_file',
          models: [
            {
              id: 'claude-sonnet-4',
              display_name: 'Claude Sonnet 4',
              capabilities,
            },
          ],
        },
      ]),
    ).toBe(false)
    expect(isWellFormedRhizomeTarget('')).toBe(false)
  })
})

describe('loadRhizomeChatModels', () => {
  it('merges a live discover and keeps the seed when a provider fails', async () => {
    const listed = await loadRhizomeChatModels(configured)
    expect(listed.some((model) => model.id === 'ollama/qwen2.5')).toBe(true)
    expect(listed.some((model) => model.id === 'work-openai/gpt-4o')).toBe(true)
  })
})

describe('resolveRhizomeChatModel', () => {
  it('keys configured models on provider id so two OpenAI accounts stay distinct', () => {
    const listed = seedRhizomeChatModels(configured)
    expect(resolveRhizomeChatModel(listed, 'work-openai/gpt-4o')?.providerName).toBe('Work OpenAI')
    expect(resolveRhizomeChatModel(listed, 'home-openai/gpt-4o')?.providerName).toBe('Home OpenAI')
  })

  it('still resolves an old kind-keyed selection to a matching configured model', () => {
    const listed = seedRhizomeChatModels(configured.slice(0, 1))
    expect(resolveRhizomeChatModel(listed, 'open_ai/gpt-4o')?.id).toBe('work-openai/gpt-4o')
  })

  it('keeps a deleted configured provider as a removed picker entry', () => {
    const listed = includeRemovedProviderModel(
      seedRhizomeChatModels(configured),
      'gone-openai/gpt-4o',
    )
    const removed = resolveRhizomeChatModel(listed, 'gone-openai/gpt-4o')
    expect(removed?.label).toBe(REMOVED_PROVIDER_LABEL)
    expect(removed?.providerName).toBe(REMOVED_PROVIDER_LABEL)
    expect(REMOVED_PROVIDER_ERROR).toBe(
      "This model's provider was removed. Pick another model, or add the provider back in Settings → AI Agents.",
    )
    expect(
      includeRemovedProviderModel(seedRhizomeChatModels(configured), 'open_ai/gpt-4o').some(
        (model) => model.label === REMOVED_PROVIDER_LABEL,
      ),
    ).toBe(false)
  })

  it('asks for a Settings key only on remote catalog kinds with no configured provider', () => {
    expect(rhizomeProviderNeedsApiKey('open_ai', configured)).toBe(false)
    expect(rhizomeProviderNeedsApiKey('gemini', configured)).toBe(true)
    expect(rhizomeProviderNeedsApiKey('ollama', [])).toBe(false)
    expect(rhizomeProviderNeedsApiKey('open_ai', [])).toBe(true)
  })

  it('omits keyless remote catalog groups and counts them for the footer', () => {
    const listed = seedRhizomeChatModels(configured)
    const keyed = excludeKeylessRhizomeModels(listed, configured)
    expect(keyed.some((model) => model.providerKind === 'gemini')).toBe(false)
    expect(keyed.some((model) => model.id === 'work-openai/gpt-4o')).toBe(true)
    expect(countKeylessRhizomeProviders(listed, configured)).toBeGreaterThan(0)
  })
})
