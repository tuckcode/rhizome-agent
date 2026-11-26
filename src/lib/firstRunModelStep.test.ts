import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { APP_STORAGE_KEYS } from '../constants/appStorage'
import {
  FIRST_RUN_MODEL_PATHS,
  completeModelStep,
  firstDetectedLocal,
  firstRunKeyPresets,
  keyProviderFor,
  localProviderFor,
  markModelStepPending,
  nativeTargetFor,
  providersWith,
  recommendedModelPath,
  shouldShowModelStep,
  useModelStepPending,
} from './firstRunModelStep'

describe('recommendedModelPath', () => {
  it('leads with a local model when one answered', () => {
    expect(recommendedModelPath({ local: { kind: 'ollama', name: 'Ollama', models: ['llama3.2'] } })).toBe('local')
  })

  it('leads with ChatGPT sign-in when no local model answered', () => {
    expect(recommendedModelPath({ local: null })).toBe('chatgpt')
  })

  it('does not lead with a local server that has no models', () => {
    expect(recommendedModelPath({ local: { kind: 'ollama', name: 'Ollama', models: [] } })).toBe('chatgpt')
  })
})

describe('firstDetectedLocal', () => {
  it('prefers Ollama over LM Studio when both answer', () => {
    const found = firstDetectedLocal([
      { kind: 'lm_studio', name: 'LM Studio', models: ['qwen'] },
      { kind: 'ollama', name: 'Ollama', models: ['llama3.2'] },
    ])
    expect(found?.kind).toBe('ollama')
  })

  it('skips a server with no models', () => {
    const found = firstDetectedLocal([
      { kind: 'ollama', name: 'Ollama', models: [] },
      { kind: 'lm_studio', name: 'LM Studio', models: ['qwen'] },
    ])
    expect(found?.kind).toBe('lm_studio')
  })

  it('returns null when nothing answered', () => {
    expect(firstDetectedLocal([])).toBeNull()
  })
})

describe('provider rows', () => {
  it('builds a local row with the chosen model and no key', () => {
    const provider = localProviderFor('ollama', 'qwen2.5')
    expect(provider.kind).toBe('ollama')
    expect(provider.api_key_storage).toBe('none')
    expect(provider.models.map((model) => model.id)).toEqual(['qwen2.5'])
    expect(nativeTargetFor(provider)).toBe('ollama/qwen2.5')
  })

  it('builds a key row that keeps the key out of settings', () => {
    const preset = firstRunKeyPresets()[0]
    const provider = keyProviderFor(preset)
    expect(provider.api_key_storage).toBe('local_file')
    expect(provider.api_key_env_var).toBeNull()
    expect(JSON.stringify(provider)).not.toMatch(/sk-/)
    expect(nativeTargetFor(provider)).toBe(`${preset.id}/${preset.modelId}`)
  })

  it('offers no Anthropic or custom row, since chat cannot run them yet', () => {
    const ids = firstRunKeyPresets().map((preset) => preset.id)
    expect(ids).not.toContain('anthropic')
    expect(ids).not.toContain('custom')
    expect(ids[0]).toBe('openai')
  })

  it('replaces a saved row with the same id instead of adding a second', () => {
    const first = localProviderFor('ollama', 'llama3.2')
    const second = localProviderFor('ollama', 'qwen2.5')
    const merged = providersWith([first], second)
    expect(merged).toHaveLength(1)
    expect(merged[0].models[0].id).toBe('qwen2.5')
  })

  it('keeps the paths in the order the step shows them', () => {
    expect(FIRST_RUN_MODEL_PATHS).toEqual(['local', 'chatgpt', 'api_key'])
  })
})

describe('pending flag', () => {
  beforeEach(() => {
    localStorage.removeItem(APP_STORAGE_KEYS.firstRunModelStep)
  })

  it('is off for a profile that never reached the vault step', () => {
    const { result } = renderHook(() => useModelStepPending())
    expect(result.current).toBe(false)
  })

  it('turns on when the vault step ends and off when the model step ends', () => {
    const { result } = renderHook(() => useModelStepPending())
    act(() => markModelStepPending())
    expect(result.current).toBe(true)
    act(() => completeModelStep())
    expect(result.current).toBe(false)
    expect(localStorage.getItem(APP_STORAGE_KEYS.firstRunModelStep)).toBe('done')
  })
})

describe('shouldShowModelStep', () => {
  it('shows when pending and no provider is saved', () => {
    expect(shouldShowModelStep({ pending: true, providers: null })).toBe(true)
  })

  it('stays hidden once a provider is saved', () => {
    expect(shouldShowModelStep({ pending: true, providers: [localProviderFor('ollama', 'llama3.2')] })).toBe(false)
  })

  it('stays hidden when not pending', () => {
    expect(shouldShowModelStep({ pending: false, providers: null })).toBe(false)
  })
})
