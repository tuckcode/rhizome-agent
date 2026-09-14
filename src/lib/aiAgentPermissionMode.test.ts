import { describe, expect, it } from 'vitest'
import en from './locales/en.json'
import {
  AI_AGENT_PERMISSION_MODE_LABELS,
  DEFAULT_AI_AGENT_PERMISSION_MODE,
  DEFAULT_PRIME_PERMISSION_MODE,
  aiAgentPermissionModeLabels,
  aiAgentPermissionModeMarker,
  defaultAiAgentPermissionMode,
  normalizeAiAgentPermissionMode,
  permissionModeIsInstructionOnly,
  resolvePermissionModeForAgent,
} from './aiAgentPermissionMode'

describe('aiAgentPermissionMode', () => {
  it('defaults missing, null, and unknown values to vault safe mode', () => {
    expect(DEFAULT_AI_AGENT_PERMISSION_MODE).toBe('safe')
    expect(normalizeAiAgentPermissionMode(undefined)).toBe('safe')
    expect(normalizeAiAgentPermissionMode(null)).toBe('safe')
    expect(normalizeAiAgentPermissionMode('danger')).toBe('safe')
  })

  it('preserves known permission modes and exposes compact labels', () => {
    expect(normalizeAiAgentPermissionMode('safe')).toBe('safe')
    expect(normalizeAiAgentPermissionMode('power_user')).toBe('power_user')
    expect(AI_AGENT_PERMISSION_MODE_LABELS.safe.short).toBe('Limited')
    expect(AI_AGENT_PERMISSION_MODE_LABELS.safe.control).toBe('Limited tools')
    expect(AI_AGENT_PERMISSION_MODE_LABELS.power_user.short).toBe('Power User')
  })

  it('defaults Prime to power user and CLI agents to safe', () => {
    expect(DEFAULT_PRIME_PERMISSION_MODE).toBe('power_user')
    expect(defaultAiAgentPermissionMode('prime')).toBe('power_user')
    expect(defaultAiAgentPermissionMode('claude_code')).toBe('safe')
    expect(resolvePermissionModeForAgent('prime', undefined)).toBe('power_user')
    expect(resolvePermissionModeForAgent('prime', null)).toBe('power_user')
    expect(resolvePermissionModeForAgent('prime', 'power_user')).toBe('power_user')
  })

  it('ignores a stored Safe vault mode for Prime sessions', () => {
    expect(resolvePermissionModeForAgent('prime', 'safe')).toBe('power_user')
  })

  it('keeps Claude Code and Antigravity on the stored vault mode', () => {
    expect(resolvePermissionModeForAgent('claude_code', 'safe')).toBe('safe')
    expect(resolvePermissionModeForAgent('antigravity', undefined)).toBe('safe')
    expect(resolvePermissionModeForAgent('claude_code', 'power_user')).toBe('power_user')
  })

  it('labels Prime as instruction, not a lock', () => {
    expect(permissionModeIsInstructionOnly('prime')).toBe(true)
    expect(permissionModeIsInstructionOnly('claude_code')).toBe(false)
    expect(aiAgentPermissionModeLabels('safe', 'en', 'prime')).toEqual({
      short: 'Notes first',
      control: 'Notes first',
    })
    expect(aiAgentPermissionModeLabels('power_user', 'en', 'prime')).toEqual({
      short: 'Full tools',
      control: 'Full tools',
    })
    expect(aiAgentPermissionModeLabels('safe', 'en', 'claude_code').control).toBe('Limited tools')
  })

  it('English Prime copy says instruction, not a sandbox or Vault Safe', () => {
    expect(en['ai.permission.safe.control']).toBe('Limited tools')
    expect(en['ai.permission.safe.control']).not.toBe('Vault Safe')
    expect(en['ai.permission.prime.safe.tooltip']).toMatch(/not a lock/)
    expect(en['ai.permission.prime.safe.tooltip']).toMatch(/no sandbox/)
    expect(en['ai.permission.prime.powerUser.tooltip']).toMatch(/not a sandbox/)
  })

  it('formats a local transcript marker for mode changes', () => {
    expect(aiAgentPermissionModeMarker('power_user')).toBe(
      'AI permission mode changed to Power User. It will apply to the next message.',
    )
    expect(aiAgentPermissionModeMarker('power_user', 'en', 'prime')).toBe(
      'AI permission mode changed to Full tools. It will apply to the next message.',
    )
  })
})
