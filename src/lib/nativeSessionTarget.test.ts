import { describe, expect, it } from 'vitest'
import { resolveNativeChatTarget } from './nativeChatTargets'
import {
  CLAUDE_CODE_SESSION_TARGET,
  isClaudeCodeSessionTarget,
  nativeSessionTarget,
  rememberNativeSessionTarget,
} from './nativeSessionTarget'

describe('nativeSessionTarget', () => {
  it('remembers the target a native chat was saved with', () => {
    rememberNativeSessionTarget('session-a', 'free_tier_auto')
    expect(nativeSessionTarget('session-a')).toBe('free_tier_auto')
    expect(nativeSessionTarget(null)).toBeNull()
  })

  it('recognizes a Claude Code chat', () => {
    expect(isClaudeCodeSessionTarget('agent:claude_code')).toBe(true)
    expect(isClaudeCodeSessionTarget(' Agent:Claude_Code ')).toBe(true)
    expect(isClaudeCodeSessionTarget('openai/gpt-4o')).toBe(false)
    expect(isClaudeCodeSessionTarget(null)).toBe(false)
  })

  it('never swaps a Claude Code chat for a default model', () => {
    expect(resolveNativeChatTarget(CLAUDE_CODE_SESSION_TARGET)).toBe(CLAUDE_CODE_SESSION_TARGET)
  })
})
