let onNativeTurnAccepted: (() => void) | null = null

/** The composer clears staged images only after the server accepts the turn. */
export function setNativeTurnAcceptedHandler(handler: (() => void) | null): void {
  onNativeTurnAccepted = handler
}

export function notifyNativeTurnAccepted(): void {
  onNativeTurnAccepted?.()
}
