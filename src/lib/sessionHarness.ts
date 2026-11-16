/**
 * Which harness ran a chat: Rhizome's own loop, or the user's installed
 * Claude Code (ADR-0191 decision 4). Read from the session's stored target,
 * so the marker stays right after a restart.
 */
export type SessionHarness = 'rhizome' | 'claude_code'

export const CLAUDE_CODE_SESSION_TARGET = 'agent:claude_code'

export const SESSION_HARNESS_LABEL: Record<SessionHarness, string> = {
  rhizome: 'Rhizome',
  // Plain description of what the chat runs. Not a Rhizome feature name,
  // and never shown with an Anthropic or Claude mark (ADR-0191 4.2, 4.4).
  claude_code: 'Claude Code',
}

export function harnessForTarget(target: string | null | undefined): SessionHarness {
  return target?.trim().toLowerCase() === CLAUDE_CODE_SESSION_TARGET ? 'claude_code' : 'rhizome'
}
