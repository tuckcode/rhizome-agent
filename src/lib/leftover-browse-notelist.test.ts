import { describe, expect, it } from 'vitest'
import { readAppShellSource } from '../test-utils/appShellSource'

describe('leftover Browse and note list', () => {
  const app = readAppShellSource()

  it('keeps Browse tied to the classic sidebar flag', () => {
    expect(app).toContain('const showSidebarTree = classicSidebarVisible')
  })

  it('keeps the note list tied to the classic note-list flag', () => {
    expect(app).toContain('const showNoteListPanel = classicNoteListVisible')
  })
})
