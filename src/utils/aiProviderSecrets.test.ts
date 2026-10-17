import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isProviderModelsCached, listAiModelProviderModels, resetListProviderModelsCache } from '../lib/listProviderModels'
import { deleteAiModelProviderApiKey, saveAiModelProviderApiKey } from './aiProviderSecrets'
import { callHost } from '../lib/callHost'
import type { AiModelProvider } from '../lib/aiTargets'

vi.mock('../lib/callHost', () => ({
  callHost: vi.fn(),
}))

const provider: AiModelProvider = {
  id: 'work-openai',
  name: 'Work OpenAI',
  kind: 'open_ai',
  base_url: 'https://api.openai.com/v1',
  api_key_storage: 'local_file',
  models: [],
}

describe('aiProviderSecrets cache invalidation', () => {
  beforeEach(() => {
    resetListProviderModelsCache()
    vi.mocked(callHost).mockReset().mockResolvedValue(['gpt-5'])
  })

  it('clears the live model cache when a key is saved', async () => {
    await listAiModelProviderModels(provider)
    expect(isProviderModelsCached(provider)).toBe(true)
    await saveAiModelProviderApiKey('work-openai', 'sk-test')
    expect(isProviderModelsCached(provider)).toBe(false)
  })

  it('clears the live model cache when a key is deleted', async () => {
    await listAiModelProviderModels(provider)
    expect(isProviderModelsCached(provider)).toBe(true)
    await deleteAiModelProviderApiKey('work-openai')
    expect(isProviderModelsCached(provider)).toBe(false)
  })
})
