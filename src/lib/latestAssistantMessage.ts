/**
 * Which Chat turn currently owns the "latest assistant reply" marker.
 *
 * The marker is a find-aid after scroll or send: only one reply shows it,
 * and it moves when a newer assistant turn starts (streaming) or lands
 * (response text). Compact/local system markers are not replies.
 */
export function latestAssistantMessageIndex(
  messages: ReadonlyArray<{
    localMarker?: string
    response?: string
    isStreaming?: boolean
  }>,
): number {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i]
    if (message.localMarker) continue
    if (message.isStreaming || Boolean(message.response?.trim())) return i
  }
  return -1
}
