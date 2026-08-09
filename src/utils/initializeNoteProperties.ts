export type UpdateFrontmatter = (
  path: string,
  key: string,
  value: string,
  options?: { silent?: boolean },
) => Promise<void>

export async function initializeNoteProperties(
  updateFrontmatter: UpdateFrontmatter,
  path: string,
): Promise<void> {
  await updateFrontmatter(path, 'type', 'Note', { silent: true })
}
