import { beforeEach, describe, expect, it, vi } from 'vitest'

const { invokeMock, isTauriMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  isTauriMock: vi.fn(),
}))

vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }))
vi.mock('../mock-tauri', () => ({ isTauri: isTauriMock }))

import { completeAiModelText } from './completeAiModelText'

const provider = { id: 'openai', name: 'OpenAI', kind: 'open_ai' as const, models: [] }
const model = {
  id: 'gpt-4.1',
  capabilities: { streaming: true, tools: false, vision: false, json_mode: false, reasoning: false },
}

describe('completeAiModelText', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('asks the native command for a plain completion with no vault', async () => {
    isTauriMock.mockReturnValue(true)
    invokeMock.mockResolvedValue('Sidebar spacing')

    await expect(completeAiModelText({
      provider,
      model,
      message: 'Title this chat',
      systemPrompt: 'Return only the title.',
    })).resolves.toBe('Sidebar spacing')

    expect(invokeMock).toHaveBeenCalledWith('complete_ai_model_text', {
      request: {
        provider,
        model_id: 'gpt-4.1',
        message: 'Title this chat',
        system_prompt: 'Return only the title.',
        vault_path: null,
        vault_paths: [],
        api_key_override: null,
        event_name: null,
      },
    })
  })

  it('returns no text outside the native app', async () => {
    isTauriMock.mockReturnValue(false)

    await expect(completeAiModelText({ provider, model, message: 'hi' })).resolves.toBe('')
    expect(invokeMock).not.toHaveBeenCalled()
  })
})
