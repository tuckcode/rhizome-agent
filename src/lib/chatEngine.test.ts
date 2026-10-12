import { describe, expect, it } from 'vitest'
import {
  chatEngineAllowsSendWithoutPrime,
  chatEngineForSave,
  chatEngineFromSettings,
  readChatEngine,
} from './chatEngine'
import { defaultNativeChatTarget, nativeChatTargetOptions, resolveNativeChatTarget } from './nativeChatTargets'

describe('chat engine setting', () => {
  it('reads prime when the value is absent', () => {
    expect(readChatEngine(undefined)).toBe('prime')
    expect(readChatEngine(null)).toBe('prime')
    expect(readChatEngine('prime')).toBe('prime')
    expect(chatEngineFromSettings({})).toBe('prime')
    expect(chatEngineForSave('prime')).toBeNull()
  })

  it('lets native send without a Prime install and keeps Prime-targeted chats gated', () => {
    expect(chatEngineAllowsSendWithoutPrime('native')).toBe(true)
    expect(chatEngineAllowsSendWithoutPrime('prime')).toBe(false)
    expect(chatEngineAllowsSendWithoutPrime(undefined)).toBe(false)
  })

  it('persists native and reads it back', () => {
    expect(chatEngineForSave('native')).toBe('native')
    expect(chatEngineFromSettings({ chat_engine: 'native' })).toBe('native')
    expect(chatEngineFromSettings({ chat_engine: chatEngineForSave('native') })).toBe('native')
  })
})

describe('native chat picker', () => {
  it('defaults to a catalog model and hides Anthropic', () => {
    const options = nativeChatTargetOptions()
    expect(options.some((option) => option.id.startsWith('anthropic/'))).toBe(false)
    expect(options.some((option) => option.id === 'free_tier_auto')).toBe(true)
    expect(defaultNativeChatTarget()).not.toBe('free_tier_auto')
    expect(defaultNativeChatTarget().includes('/')).toBe(true)
    expect(resolveNativeChatTarget(null)).toBe(defaultNativeChatTarget())
    expect(resolveNativeChatTarget('open_ai/gpt-4o')).toBe('open_ai/gpt-4o')
  })

  it('lists an OpenRouter Claude model and still hides a direct Anthropic target', () => {
    const options = nativeChatTargetOptions([
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
            capabilities: {
              streaming: true,
              tools: true,
              vision: true,
              json_mode: true,
              reasoning: false,
            },
          },
        ],
      },
    ])
    expect(options.some((option) => option.id === 'home-openrouter/anthropic/claude-sonnet-4')).toBe(
      true,
    )
    expect(options.some((option) => option.id.startsWith('anthropic/'))).toBe(false)
  })
})
