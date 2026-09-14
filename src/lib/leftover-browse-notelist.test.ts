import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover Browse and note list', () => {
  const app = readFileSync(`${process.cwd()}/src/App.tsx`, 'utf8')

  it('keeps Browse tied to the classic sidebar flag', () => {
    expect(app).toContain('const showSidebarTree = classicSidebarVisible')
  })

  it('keeps the note list tied to the classic note-list flag', () => {
    expect(app).toContain('const showNoteListPanel = classicNoteListVisible')
  })
})
