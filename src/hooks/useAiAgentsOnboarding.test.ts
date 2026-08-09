import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useAiAgentsOnboarding } from './useAiAgentsOnboarding'

const DISMISSED_KEY = 'rhizome:ai-agents-onboarding-dismissed'
const LEGACY_KEY = 'tolaria:claude-code-onboarding-dismissed'

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true })

describe('useAiAgentsOnboarding', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => localStorage.clear())

  it('shows the prompt when enabled and not previously dismissed', () => {
    const { result } = renderHook(() => useAiAgentsOnboarding(true))
    expect(result.current.showPrompt).toBe(true)
  })

  it('hides the prompt when disabled', () => {
    const { result } = renderHook(() => useAiAgentsOnboarding(false))
    expect(result.current.showPrompt).toBe(false)
  })

  it('persists dismissal and hides the prompt', () => {
    const { result } = renderHook(() => useAiAgentsOnboarding(true))
    act(() => result.current.dismissPrompt())
    expect(result.current.showPrompt).toBe(false)
    expect(localStorage.getItem(DISMISSED_KEY)).toBe('1')
  })

  it('starts hidden when already dismissed in a prior session', () => {
    localStorage.setItem(DISMISSED_KEY, '1')
    const { result } = renderHook(() => useAiAgentsOnboarding(true))
    expect(result.current.showPrompt).toBe(false)
  })

  it('reopens a dismissed prompt and clears the persisted flags', () => {
    localStorage.setItem(DISMISSED_KEY, '1')
    localStorage.setItem(LEGACY_KEY, '1')
    const { result } = renderHook(() => useAiAgentsOnboarding(true))
    expect(result.current.showPrompt).toBe(false)

    act(() => result.current.reopenPrompt())
    expect(result.current.showPrompt).toBe(true)
    expect(localStorage.getItem(DISMISSED_KEY)).toBeNull()
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull()
  })
})
