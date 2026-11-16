/** Saved target of a native chat that runs on the user's Claude Code (ADR-0191). */
export const CLAUDE_CODE_SESSION_TARGET = 'agent:claude_code'

export function isClaudeCodeSessionTarget(target: string | null | undefined): boolean {
  return target?.trim().toLowerCase() === CLAUDE_CODE_SESSION_TARGET
}

const targets = new Map<string, string>()

/** The model stored on a native session log. */
export function rememberNativeSessionTarget(sessionId: string, target: string): void {
  const id = sessionId.trim()
  const model = target.trim()
  if (!id || !model) return
  targets.set(id, model)
}

export function nativeSessionTarget(sessionId: string | null | undefined): string | null {
  if (!sessionId) return null
  return targets.get(sessionId) ?? null
}
