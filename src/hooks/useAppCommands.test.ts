import { describe, expect, it, vi } from 'vitest'
import { createCommandRegistryAiConfig } from './useAppCommands'

describe('createCommandRegistryAiConfig', () => {
  it('forwards onReopenAiOnboarding through to the command registry config', () => {
    const onReopenAiOnboarding = vi.fn()
    const result = createCommandRegistryAiConfig({
      onReopenAiOnboarding,
    })

    expect(result.onReopenAiOnboarding).toBe(onReopenAiOnboarding)
  })
})
