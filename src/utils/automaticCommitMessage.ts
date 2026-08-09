import type { ModifiedFile } from '../types'

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural
}

function allFilesAreNotes(files: ModifiedFile[]): boolean {
  return files.every((file) => file.relativePath.toLowerCase().endsWith('.md'))
}

export function generateAutomaticCommitMessage(files: ModifiedFile[]): string {
  if (files.length === 0) return ''
  const noun = allFilesAreNotes(files)
    ? pluralize(files.length, 'note', 'notes')
    : pluralize(files.length, 'file', 'files')
  return `Updated ${files.length} ${noun}`
}
