/**
 * The `/goal` text Prime's own session-command parser expects (#20).
 *
 * There is no protocol call for setting a goal — probed against the
 * installed daemon's `DAEMON_COMMAND_TYPES`, which lists no `goal_create` or
 * equivalent. Prime's own CLI sets a goal the same way: `/goal [--budget N]
 * <objective>` sent as ordinary prompt text, parsed as a session command
 * before the model ever sees it. This module only builds and validates that
 * text; the Rust side (`prime_session_host::set_goal`) is what actually
 * sends it and re-reads state to confirm.
 */

/** Build the exact `/goal` text Prime's parser accepts. */
export function buildGoalCommandText(objective: string, tokenBudget: number | null): string {
  const trimmed = objective.trim()
  return tokenBudget ? `/goal --budget ${tokenBudget} ${trimmed}` : `/goal ${trimmed}`
}

/**
 * Parse a budget field's raw text.
 *
 * `null` means no budget was requested — a legitimate choice, not an error.
 * `'invalid'` means the text was non-empty but not a positive integer, which
 * Prime's parser would reject the same way.
 */
export function parseGoalBudgetInput(raw: string): number | 'invalid' | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (!/^[1-9]\d*$/.test(trimmed)) return 'invalid'
  return Number(trimmed)
}
