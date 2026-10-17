import { describe, expect, it } from 'vitest'
import {
  chatEngineAllowsSendWithoutPrime,
  chatEngineForSave,
  chatEngineFromSettings,
  readChatEngine,
} from './chatEngine'
import {
  defaultNativeChatTarget,
  isAnthropicNativeTarget,
  nativeChatTargetOptions,
  resolveNativeChatTarget,
} from './nativeChatTargets'

describe('chat engine setting', () => {
  it('reads native when the value is absent', () => {
    expect(readChatEngine(undefined)).toBe('native')
    expect(readChatEngine(null)).toBe('native')
    expect(readChatEngine('')).toBe('native')
    expect(readChatEngine('native')).toBe('native')
    expect(chatEngineFromSettings({})).toBe('native')
    expect(chatEngineFromSettings(null)).toBe('native')
    expect(chatEngineForSave('native')).toBe('native')
  })

  it('lets the default engine send without a Prime install and keeps Prime-targeted chats gated', () => {
    expect(chatEngineAllowsSendWithoutPrime('native')).toBe(true)
    expect(chatEngineAllowsSendWithoutPrime(undefined)).toBe(true)
    expect(chatEngineAllowsSendWithoutPrime('prime')).toBe(false)
  })

  it('persists prime and reads it back', () => {
    expect(readChatEngine('prime')).toBe('prime')
    expect(chatEngineForSave('prime')).toBe('prime')
    expect(chatEngineFromSettings({ chat_engine: 'prime' })).toBe('prime')
    expect(chatEngineFromSettings({ chat_engine: chatEngineForSave('prime') })).toBe('prime')
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

  it('refuses a saved pick from a custom-named Anthropic provider', () => {
    const workAnthropic = {
      id: 'work-anthropic',
      name: 'Work Anthropic',
      kind: 'anthropic' as const,
      base_url: 'https://api.anthropic.com/v1',
      api_key_storage: 'local_file' as const,
      models: [
        {
          id: 'claude-sonnet-4',
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
    }
    const homeOpenRouter = {
      id: 'home-openrouter',
      name: 'Home OpenRouter',
      kind: 'open_router' as const,
      base_url: 'https://openrouter.ai/api/v1',
      api_key_storage: 'local_file' as const,
      models: [
        {
          id: 'anthropic/claude-sonnet-4',
          display_name: 'Claude Sonnet 4',
          capabilities: workAnthropic.models[0].capabilities,
        },
      ],
    }

    expect(isAnthropicNativeTarget('work-anthropic/claude-sonnet-4', [workAnthropic])).toBe(true)
    expect(
      isAnthropicNativeTarget('home-openrouter/anthropic/claude-sonnet-4', [homeOpenRouter]),
    ).toBe(false)
    expect(resolveNativeChatTarget('work-anthropic/claude-sonnet-4', [workAnthropic])).toBe(
      defaultNativeChatTarget([workAnthropic]),
    )
    expect(resolveNativeChatTarget('work-anthropic/claude-sonnet-4', [workAnthropic])).not.toBe(
      'work-anthropic/claude-sonnet-4',
    )
  })
})
