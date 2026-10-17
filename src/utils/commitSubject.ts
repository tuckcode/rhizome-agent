/** First non-blank line of a commit message — the subject shown in History rows. */
export function commitSubject(message: string): string {
  return message.split(/\r\n|\r|\n/).map((line) => line.trim()).find(Boolean) ?? ''
}
