import { describe, expect, it, vi } from 'vitest'
import type { AiModelProvider } from './aiTargets'
import {
  filterRhizomeChatModels,
  groupRhizomeChatModels,
  isWellFormedRhizomeTarget,
  loadRhizomeChatModels,
  resolveRhizomeChatModel,
  seedRhizomeChatModels,
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
})
