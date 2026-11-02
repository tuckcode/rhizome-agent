import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AiModelProvider } from './aiTargets'
import { callHost } from './callHost'
import {
  forgetListedProviderModels,
  listAiModelProviderModels,
  liveModelDisplayName,
  liveProviderHeadingNames,
  loadLiveRhizomeChatModels,
  MODEL_LIST_TIMEOUT_MS,
  normalizeListedProviderModels,
  offlineLiveProviderNames,
  providerListFailure,
  providerModelsCacheKey,
  providersToListLive,
  resetListProviderModelsCache,
  withChatgptAccountModels,
} from './listProviderModels'

vi.mock('./callHost', () => ({
  callHost: vi.fn(),
}))

const capabilities = {
  streaming: true,
  tools: true,
  vision: true,
  json_mode: true,
  reasoning: { state: 'unknown' as const },
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
    expect(offlineLiveProviderNames([provider])).toEqual(['Work OpenAI'])
    await expect(listAiModelProviderModels(provider)).resolves.toEqual(['grok-4'])
    expect(offlineLiveProviderNames([provider])).toEqual([])
    expect(callHost).toHaveBeenCalledTimes(2)
  })

  it('refetches when the provider base URL changes', async () => {
    const provider = keyedOpenAi()
    vi.mocked(callHost).mockResolvedValue(['grok-4'])
    await listAiModelProviderModels(provider)
    const moved = { ...provider, base_url: 'https://other.example/v1' }
    expect(providerModelsCacheKey(moved)).not.toBe(providerModelsCacheKey(provider))
    vi.mocked(callHost).mockResolvedValue(['grok-5'])
    await expect(listAiModelProviderModels(moved)).resolves.toEqual(['grok-5'])
    expect(callHost).toHaveBeenCalledTimes(2)
  })
})

describe('replaced model list requests', () => {
  it('does not let a slow request erase the one that replaced it', async () => {
    const provider = keyedOpenAi()
    let releaseFirst: (value: string[]) => void = () => {}
    const first = new Promise<string[]>((resolve) => {
      releaseFirst = resolve
    })
    vi.mocked(callHost)
      .mockImplementationOnce(() => first)
      .mockResolvedValue(['next-model'])

    const stale = listAiModelProviderModels(provider)
    forgetListedProviderModels(provider)
    const fresh = listAiModelProviderModels(provider)
    releaseFirst(['stale-model'])
    await expect(fresh).resolves.toEqual(['next-model'])
    await stale
    await expect(listAiModelProviderModels(provider)).resolves.toEqual(['next-model'])
  })
})

describe('normalizeListedProviderModels', () => {
  it('keeps a one-character id from an array and does not split a string body', () => {
    expect(normalizeListedProviderModels(['m'])).toEqual([{ id: 'm', displayName: 'm' }])
    expect(normalizeListedProviderModels('models')).toEqual([])
  })
})

describe('model list timeout', () => {
  it('stops a hung list after 10s and lets Retry ask again', async () => {
    vi.useFakeTimers()
    let calls = 0
    vi.mocked(callHost).mockImplementation(() => {
      calls += 1
      if (calls === 1) return new Promise(() => {})
      return Promise.resolve(['llama3.2'])
    })
    const provider = {
      id: 'ollama',
      name: 'Ollama',
      kind: 'ollama' as const,
      base_url: 'http://localhost:11434/v1',
      api_key_storage: 'none' as const,
      models: [{ id: 'llama3.2', display_name: 'llama3.2', capabilities }],
    }
    const pending = listAiModelProviderModels(provider)
    await vi.advanceTimersByTimeAsync(MODEL_LIST_TIMEOUT_MS)
    await expect(pending).resolves.toEqual(['llama3.2'])
    expect(providerListFailure(provider)).toBe('timeout')
    expect(MODEL_LIST_TIMEOUT_MS).toBe(10_000)

    forgetListedProviderModels(provider)
    await expect(listAiModelProviderModels(provider)).resolves.toEqual(['llama3.2'])
    expect(providerListFailure(provider)).toBeNull()
    vi.useRealTimers()
  })
})

describe('liveModelDisplayName', () => {
  it('uses the API display name when the host sends one', () => {
    expect(liveModelDisplayName('qwen2.5', 'Qwen 2.5')).toBe('Qwen 2.5')
  })

  it('cleans a raw id when the API sends only that', () => {
    expect(liveModelDisplayName('accounts/fireworks/models/qwen2.5:latest')).toBe('qwen2.5')
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

  it('normalizes a mixed-case provider id so live rows match the seed', async () => {
    const provider = { ...keyedOpenAi(), id: 'Work-OpenAI' }
    vi.mocked(callHost).mockImplementation(async (_cmd, args) => {
      const listed = args?.provider as { id?: string; kind?: string } | undefined
      if (listed?.id === 'work-openai') return ['gpt-4o', 'gpt-5']
      return []
    })

    const listed = await loadLiveRhizomeChatModels([provider])
    const ids = listed.map((model) => model.id)
    expect(ids).toContain('work-openai/gpt-4o')
    expect(ids).toContain('work-openai/gpt-5')
    expect(ids).not.toContain('Work-OpenAI/gpt-4o')
    expect(ids).not.toContain('Work-OpenAI/gpt-5')
    expect(listed.filter((model) => model.modelId === 'gpt-4o')).toHaveLength(1)
    expect(providersToListLive([provider]).map((item) => item.id)).toContain('work-openai')
  })

  it('uses an API display name on live-only rows', async () => {
    vi.mocked(callHost).mockImplementation(async (_cmd, args) => {
      const provider = args?.provider as { kind?: string } | undefined
      if (provider?.kind === 'ollama') return [{ id: 'qwen2.5', display_name: 'Qwen 2.5' }]
      return []
    })

    const listed = await loadLiveRhizomeChatModels([])
    expect(listed.find((model) => model.id === 'ollama/qwen2.5')?.displayName).toBe('Qwen 2.5')
  })
})

describe('liveProviderHeadingNames', () => {
  it('hides catalog locals the user never set up after they fail', async () => {
    vi.mocked(callHost).mockRejectedValue(new Error('provider offline'))
    await loadLiveRhizomeChatModels([])
    expect(liveProviderHeadingNames([])).not.toContain('Ollama')
    expect(liveProviderHeadingNames([])).not.toContain('LM Studio')
  })

  it('names a local provider after it answers', async () => {
    vi.mocked(callHost).mockImplementation(async (_cmd, args) => {
      const provider = args?.provider as { kind?: string } | undefined
      if (provider?.kind === 'ollama') return ['llama3.2']
      return []
    })
    await loadLiveRhizomeChatModels([])
    expect(liveProviderHeadingNames([])).toContain('Ollama')
  })

  it('names a local provider the user set up', () => {
    const home: AiModelProvider = {
      id: 'home-ollama',
      name: 'Home Ollama',
      kind: 'ollama',
      api_key_storage: 'none',
      models: [{ id: 'llama3.2', display_name: 'Llama 3.2', capabilities }],
    }
    expect(liveProviderHeadingNames([home])).toContain('Home Ollama')
    expect(liveProviderHeadingNames([home])).not.toContain('Ollama')
  })
})

describe('withChatgptAccountModels', () => {
  const row = (id: string, providerId: string, providerKind: string) => ({
    id,
    providerId,
    providerKind,
    providerName: providerId === 'openai' ? 'OpenAI' : providerId,
    modelId: id.split('/')[1],
    displayName: id.split('/')[1],
    label: id,
  })
  const seed = [
    row('openai/gpt-4.1-mini', 'openai', 'open_ai'),
    row('ollama/llama3.2', 'ollama', 'ollama'),
    row('free_tier/auto', 'free_tier', 'free_tier'),
  ]

  it('replaces the catalog OpenAI row with the account models, above Free', () => {
    const next = withChatgptAccountModels(seed, [{ slug: 'gpt-6-astra', displayName: 'GPT-6 Astra' }])
    expect(next.map((model) => model.id)).toEqual([
      'ollama/llama3.2',
      'openai/gpt-6-astra',
      'free_tier/auto',
    ])
    expect(next[1].label).toBe('OpenAI · GPT-6 Astra')
  })

  it('keeps the seed rows when the account lists nothing', () => {
    expect(withChatgptAccountModels(seed, [])).toBe(seed)
  })
})
