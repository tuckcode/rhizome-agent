import { renderHook, act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createAiAgentAvailability,
  createMissingAiAgentsStatus,
  type AiAgentsStatus,
} from '../lib/aiAgents'
import { useAiAgentPreferences } from './useAiAgentPreferences'

const settings = {
  auto_pull_interval_minutes: 5,
  telemetry_consent: true,
  crash_reporting_enabled: false,
  analytics_enabled: false,
  anonymous_id: null,
  release_channel: 'stable',
  default_ai_agent: 'prime' as const,
}

const aiAgentsStatus: AiAgentsStatus = {
  ...createMissingAiAgentsStatus(),
  prime: createAiAgentAvailability('installed', '1.0.20'),
}

describe('useAiAgentPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resolves the selected label and readiness', () => {
    const { result } = renderHook(() => useAiAgentPreferences({
      settings,
      settingsLoaded: true,
      saveSettings: vi.fn(),
      aiAgentsStatus,
    }))

    expect(result.current.defaultAiAgent).toBe('prime')
    expect(result.current.defaultAiAgentLabel).toBe('Prime Agent')
    expect(result.current.defaultAiAgentReadiness).toBe('ready')
    expect(result.current.defaultAiAgentReady).toBe(true)
  })

  it('coerces a legacy stored agent to Prime, the only product-visible target', () => {
    const { result } = renderHook(() => useAiAgentPreferences({
      settings: { ...settings, default_ai_agent: 'claude_code' },
      settingsLoaded: true,
      saveSettings: vi.fn(),
      aiAgentsStatus: {
        ...aiAgentsStatus,
        claude_code: createAiAgentAvailability('installed', '1.0.20'),
      },
    }))

    expect(result.current.defaultAiAgent).toBe('prime')
    expect(result.current.defaultAiAgentLabel).toBe('Prime Agent')
  })

  it('keeps the selected agent unavailable while settings are loading', () => {
    const { result } = renderHook(() => useAiAgentPreferences({
      settings,
      settingsLoaded: false,
      saveSettings: vi.fn(),
      aiAgentsStatus,
    }))

    expect(result.current.defaultAiAgentReadiness).toBe('checking')
    expect(result.current.defaultAiAgentReady).toBe(false)
  })

  it('cycles within the product agent list — Prime-only, so it stays on Prime — and persists it', () => {
    const saveSettings = vi.fn()
    const onToast = vi.fn()

    const { result } = renderHook(() => useAiAgentPreferences({
      settings,
      settingsLoaded: true,
      saveSettings,
      aiAgentsStatus,
      onToast,
    }))

    act(() => {
      result.current.cycleDefaultAiAgent()
    })

    expect(saveSettings).toHaveBeenCalledWith({
      ...settings,
      default_ai_agent: 'prime',
      default_ai_target: 'agent:prime',
    })
    expect(onToast).toHaveBeenCalledWith('Default AI agent: Prime Agent')
  })

  it('keeps the browser mock agent composer enabled when no CLI is installed', () => {
    const { result } = renderHook(() => useAiAgentPreferences({
      settings,
      settingsLoaded: true,
      saveSettings: vi.fn(),
      aiAgentsStatus: createMissingAiAgentsStatus(),
    }))

    expect(result.current.defaultAiAgentReady).toBe(true)
  })
})
