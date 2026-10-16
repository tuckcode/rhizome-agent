import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AiModelProvider } from './aiTargets'
import { callHost } from './callHost'
import {
  listAiModelProviderModels,
  loadLiveRhizomeChatModels,
  resetListProviderModelsCache,
} from './listProviderModels'

vi.mock('./callHost', () => ({
  callHost: vi.fn(),
}))

const capabilities = {
  streaming: true,
  tools: true,
  vision: true,
  json_mode: true,
  reasoning: false,
}

function keyedOpenAi(): AiModelProvider {
  return {
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
  }
}

function keylessCompatible(): AiModelProvider {
  return {
    id: 'lab',
    name: 'Lab',
    kind: 'open_ai_compatible',
    base_url: 'https://lab.example/v1',
    api_key_storage: 'none',
    models: [
      {
        id: 'lab-1',
        display_name: 'Lab 1',
        capabilities,
      },
    ],
  }
}

beforeEach(() => {
  resetListProviderModelsCache()
  vi.mocked(callHost).mockReset()
})

describe('listAiModelProviderModels', () => {
  it('lists live ids when the provider has a key', async () => {
    const provider = keyedOpenAi()
    vi.mocked(callHost).mockResolvedValue(['grok-4', 'grok-3-mini'])

    await expect(listAiModelProviderModels(provider)).resolves.toEqual(['grok-4', 'grok-3-mini'])
    expect(callHost).toHaveBeenCalledWith('list_ai_model_provider_models', { provider })
  })

  it('returns the static list when no key is set', async () => {
    await expect(listAiModelProviderModels(keylessCompatible())).resolves.toEqual(['lab-1'])
    expect(callHost).not.toHaveBeenCalled()
  })

  it('returns the static list when the host fails', async () => {
    vi.mocked(callHost).mockRejectedValue(new Error('provider offline'))

    await expect(listAiModelProviderModels(keyedOpenAi())).resolves.toEqual(['gpt-4o'])
    expect(callHost).toHaveBeenCalledTimes(1)
  })

  it('caches a successful list for the rest of the session', async () => {
    const provider = keyedOpenAi()
    vi.mocked(callHost).mockResolvedValue(['grok-4'])

    await expect(listAiModelProviderModels(provider)).resolves.toEqual(['grok-4'])
    await expect(listAiModelProviderModels(provider)).resolves.toEqual(['grok-4'])
    expect(callHost).toHaveBeenCalledTimes(1)
  })

  it('does not cache a failed list', async () => {
    const provider = keyedOpenAi()
    vi.mocked(callHost)
      .mockRejectedValueOnce(new Error('provider offline'))
      .mockResolvedValueOnce(['grok-4'])

    await expect(listAiModelProviderModels(provider)).resolves.toEqual(['gpt-4o'])
    await expect(listAiModelProviderModels(provider)).resolves.toEqual(['grok-4'])
    expect(callHost).toHaveBeenCalledTimes(2)
  })
})

describe('loadLiveRhizomeChatModels', () => {
  it('merges live ids into the seed catalog', async () => {
    vi.mocked(callHost).mockImplementation(async (_cmd, args) => {
      const provider = args?.provider as { id?: string; kind?: string } | undefined
      if (provider?.id === 'work-openai') return ['gpt-4o', 'gpt-5']
      if (provider?.kind === 'ollama') return ['llama3.2', 'qwen2.5']
      return []
    })

    const listed = await loadLiveRhizomeChatModels([keyedOpenAi()])
    expect(listed.some((model) => model.id === 'work-openai/gpt-5')).toBe(true)
    expect(listed.some((model) => model.id === 'ollama/qwen2.5')).toBe(true)
    expect(listed.find((model) => model.id === 'work-openai/gpt-4o')?.displayName).toBe('GPT-4o')
  })
})
