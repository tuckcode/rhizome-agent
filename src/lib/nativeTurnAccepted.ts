const handlers = new Map<string, () => void>()

/** One composer per panel or session. Unregister only that key. */
export function setNativeTurnAcceptedHandler(key: string, handler: (() => void) | null): void {
  if (handler) handlers.set(key, handler)
  else handlers.delete(key)
}

export function notifyNativeTurnAccepted(key: string | null | undefined): void {
  if (!key) return
  handlers.get(key)?.()
}
