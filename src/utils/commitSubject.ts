/** First line of a commit message — the subject shown in History rows. */
export function commitSubject(message: string): string {
  return message.split(/\r?\n/, 1)[0]?.trim() ?? ''
}
