import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import en from './locales/en.json'
import {
  AI_AGENT_PERMISSION_MODE_LABELS,
  aiAgentPermissionModeLabels,
  permissionModeIsInstructionOnly,
} from './aiAgentPermissionMode'

describe('leftover C57 limited tools', () => {
  it('locks Limited tools / Power User labels', () => {
    expect(AI_AGENT_PERMISSION_MODE_LABELS.safe.short).toBe('Limited')
    expect(AI_AGENT_PERMISSION_MODE_LABELS.safe.control).toBe('Limited tools')
    expect(AI_AGENT_PERMISSION_MODE_LABELS.power_user.short).toBe('Power User')
    expect(AI_AGENT_PERMISSION_MODE_LABELS.power_user.control).toBe('Power User')

    expect(aiAgentPermissionModeLabels('safe', 'en', 'claude_code').control).toBe(
      'Limited tools',
    )
    expect(aiAgentPermissionModeLabels('power_user', 'en', 'claude_code').control).toBe(
      'Power User',
    )
  })

  it('forbids Vault Safe copy', () => {
    const labelText = Object.values(AI_AGENT_PERMISSION_MODE_LABELS)
      .flatMap((entry) => [entry.short, entry.control])
      .join(' ')
    expect(labelText).not.toContain('Vault Safe')
    expect(en['ai.permission.safe.control']).toBe('Limited tools')
    expect(en['ai.permission.safe.control']).not.toBe('Vault Safe')

    const source = readFileSync(
      `${process.cwd()}/src/lib/aiAgentPermissionMode.ts`,
      'utf8',
    )
    expect(source).not.toMatch(/Vault Safe/)
  })

  it('exports permissionModeIsInstructionOnly for Prime instruction-only mode', () => {
    expect(typeof permissionModeIsInstructionOnly).toBe('function')
    expect(permissionModeIsInstructionOnly('prime')).toBe(true)
    expect(permissionModeIsInstructionOnly('claude_code')).toBe(false)

    const source = readFileSync(
      `${process.cwd()}/src/lib/aiAgentPermissionMode.ts`,
      'utf8',
    )
    expect(source).toContain('export function permissionModeIsInstructionOnly')
    expect(source).toContain('Prime has no sandbox')
  })
})
