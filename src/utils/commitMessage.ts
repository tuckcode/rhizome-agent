import type { ModifiedFile } from '../types'

const VERB_MAP: Record<string, string> = {
  modified: 'Update',
  added: 'Add',
  untracked: 'Add',
  deleted: 'Delete',
  renamed: 'Rename',
}

const MAX_LISTED_FILES = 3

function noteName(relativePath: string): string {
  const basename = relativePath.split('/').pop() ?? relativePath
  return basename.replace(/\.md$/, '')
}

function verb(files: ModifiedFile[]): string {
  const statuses = new Set(files.map((f) => f.status))
  if (statuses.size === 1) return VERB_MAP[files[0].status] ?? 'Update'
  return 'Update'
}

/** Generate a heuristic commit message from modified files. */
export function generateCommitMessage(files: ModifiedFile[]): string {
  if (files.length === 0) return ''
  const action = verb(files)
  if (files.length <= MAX_LISTED_FILES) {
    const names = files.map((f) => noteName(f.relativePath)).join(', ')
    return `${action} ${names}`
  }
  return `${action} ${files.length} notes`
}
