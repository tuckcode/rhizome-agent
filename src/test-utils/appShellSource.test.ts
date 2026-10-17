import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { APP_SHELL_SOURCE_FILES, readAppShellSource } from './appShellSource'

describe('readAppShellSource', () => {
  it('includes App.tsx content', () => {
    const appOnly = readFileSync(join(process.cwd(), 'src/App.tsx'), 'utf8')
    expect(readAppShellSource()).toContain(appOnly)
  })

  it('includes every listed shell source file', () => {
    const combined = readAppShellSource()
    for (const relativePath of APP_SHELL_SOURCE_FILES) {
      const fileText = readFileSync(join(process.cwd(), relativePath), 'utf8')
      expect(combined).toContain(fileText)
    }
  })

  it('uses a separator of at least 100 characters between files', () => {
    const combined = readAppShellSource()
    const separatorMatches = combined.match(/\n\/\/ ={100,}\n/g) ?? []
    expect(separatorMatches.length).toBe(APP_SHELL_SOURCE_FILES.length - 1)
    for (const separator of separatorMatches) {
      expect(separator.replace(/\n/g, '').length).toBeGreaterThanOrEqual(100)
    }
  })
})
