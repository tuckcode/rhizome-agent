import type { AiAction } from '../components/AiMessage'

export function lastToolName(
  messages: ReadonlyArray<{ actions: readonly AiAction[] }>,
): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const actions = messages[i].actions
    if (actions.length === 0) continue
    return actions[actions.length - 1]?.tool ?? null
  }
  return null
}
