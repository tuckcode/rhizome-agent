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
