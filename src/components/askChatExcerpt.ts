export function formatAskChatExcerpt(noteTitle: string, excerpt: string): string {
  return `Look at this excerpt from “${noteTitle}”:\n\n> ${excerpt.trim()}\n\nWhat should I know?`
}
