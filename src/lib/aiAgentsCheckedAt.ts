let checkedAt: number | null = null
const listeners = new Set<() => void>()

/** When the agent probe actually finished. Not the moment a card mounted. */
export function noteAiAgentsChecked(at = Date.now()): void {
  checkedAt = at
  for (const listener of listeners) listener()
}

export function aiAgentsCheckedAt(): number | null {
  return checkedAt
}

export function subscribeAiAgentsCheckedAt(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function resetAiAgentsCheckedAt(): void {
  checkedAt = null
}
