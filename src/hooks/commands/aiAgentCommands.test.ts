import { describe, expect, it, vi } from 'vitest'
import { buildAiAgentCommands } from './aiAgentCommands'

describe('buildAiAgentCommands', () => {
  it('does not expose Prime or Hermes as switch targets', () => {
    const onSetDefaultAiAgent = vi.fn()

    const commands = buildAiAgentCommands({
      aiAgentsStatus: {
        prime: { status: 'installed', version: '0.9.5' },
        claude_code: { status: 'installed', version: '1.0.20' },
        codex: { status: 'installed', version: '0.37.0' },
        opencode: { status: 'missing', version: null },
        antigravity: { status: 'missing', version: null },
        kiro: { status: 'missing', version: null },
        hermes: { status: 'installed', version: 'Hermes Agent 0.16.0' },
      },
      selectedAiAgent: 'claude_code',
      onSetDefaultAiAgent,
    })

    expect(commands.find((item) => item.id === 'switch-ai-agent-hermes')).toBeUndefined()
    expect(commands.find((item) => item.id === 'switch-ai-agent-prime')).toBeUndefined()
    const command = commands.find((item) => item.id === 'switch-ai-agent-codex')
    expect(command).toMatchObject({
      label: 'Switch AI Agent to Codex',
      enabled: true,
    })
    command?.execute()
    expect(onSetDefaultAiAgent).toHaveBeenCalledWith('codex')
  })

  it('adds a restore guidance command when the vault guidance needs repair', () => {
    const onRestoreVaultAiGuidance = vi.fn()

    const commands = buildAiAgentCommands({
      vaultAiGuidanceStatus: {
        agentsState: 'missing',
        claudeState: 'managed',
        geminiState: 'managed',
        canRestore: true,
      },
      onRestoreVaultAiGuidance,
    })

    const command = commands.find((item) => item.id === 'restore-vault-ai-guidance')
    expect(command).toBeDefined()
    expect(command?.keywords).toContain('antigravity')
    expect(command?.keywords).toContain('gemini')
    command?.execute()
    expect(onRestoreVaultAiGuidance).toHaveBeenCalledOnce()
  })

  it('omits the restore command when the vault guidance is already healthy', () => {
    const commands = buildAiAgentCommands({
      vaultAiGuidanceStatus: {
        agentsState: 'managed',
        claudeState: 'managed',
        geminiState: 'managed',
        canRestore: false,
      },
      onRestoreVaultAiGuidance: vi.fn(),
    })

    expect(commands.find((item) => item.id === 'restore-vault-ai-guidance')).toBeUndefined()
  })
})
