import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Append each new MainApp extraction module here (one path per PR). */
export const APP_SHELL_SOURCE_FILES = ['src/App.tsx'] as const

const APP_SHELL_SOURCE_SEPARATOR = `\n// ${'='.repeat(100)}\n`

export function readAppShellSource(): string {
  const root = process.cwd()
  return APP_SHELL_SOURCE_FILES
    .map((relativePath) => readFileSync(join(root, relativePath), 'utf8'))
    .join(APP_SHELL_SOURCE_SEPARATOR)
}
