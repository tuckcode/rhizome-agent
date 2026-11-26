import { describe, expect, it } from 'vitest'
import { harnessForTarget, SESSION_HARNESS_LABEL } from './sessionHarness'

describe('harnessForTarget', () => {
  it('reads Claude Code only from the agent:claude_code target', () => {
    expect(harnessForTarget('agent:claude_code')).toBe('claude_code')
    expect(harnessForTarget(' Agent:Claude_Code ')).toBe('claude_code')
  })

  it('treats every other target, and none, as Rhizome', () => {
    for (const target of ['openai:gpt-5', 'anthropic:claude-opus', 'agent:codex', 'claude_code', '', null, undefined]) {
      expect(harnessForTarget(target)).toBe('rhizome')
    }
  })

  it('labels Claude Code in plain text', () => {
    expect(SESSION_HARNESS_LABEL.claude_code).toBe('Claude Code')
    expect(SESSION_HARNESS_LABEL.rhizome).toBe('Rhizome')
  })
})
