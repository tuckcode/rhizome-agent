import { describe, expect, it, vi } from 'vitest'
import { createCommandRegistryAiConfig } from './useAppCommands'

describe('createCommandRegistryAiConfig', () => {
  it('forwards onReopenAiOnboarding through to the command registry config', () => {
    const onReopenAiOnboarding = vi.fn()
    const result = createCommandRegistryAiConfig({
      aiFeaturesEnabled: true,
      onReopenAiOnboarding,
    })

    expect(result.onReopenAiOnboarding).toBe(onReopenAiOnboarding)
  })

  it('drops onReopenAiOnboarding when AI features are disabled', () => {
    const onReopenAiOnboarding = vi.fn()
    const result = createCommandRegistryAiConfig({
      aiFeaturesEnabled: false,
      onReopenAiOnboarding,
    })

    expect(result.onReopenAiOnboarding).toBeUndefined()
  })
})
