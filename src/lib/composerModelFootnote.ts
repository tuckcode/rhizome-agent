/**
 * The composer pick writes `native_chat_target` (the default for new chats).
 * A send on an existing native session uses the model stored on that session
 * first (`stored || request.target` in streamNativeChat). The pick does not
 * rewrite that stored model.
 */
export function composerModelFootnote(
  sessionLabel: string | null | undefined,
  pickedLabel: string,
): string {
  const session = sessionLabel?.trim()
  const picked = pickedLabel.trim()
  if (session && session !== picked) {
    return `New chats use this model. This chat stays on ${session}.`
  }
  return 'New chats use this model.'
}
