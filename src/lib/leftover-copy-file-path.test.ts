import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover Copy file path on notes', () => {
  it('locks Copy file path on the existing toolbar key', () => {
    const en = readFileSync(`${process.cwd()}/src/lib/locales/en.json`, 'utf8')
    expect(en).toContain('"editor.toolbar.copyFilePath": "Copy file path"')
  })

  it('reads that key as the note-list context menu label', () => {
    const menu = readFileSync(
      `${process.cwd()}/src/components/note-list/NoteListContextMenuView.tsx`,
      'utf8',
    )
    expect(menu).toContain("label: translate(locale, 'editor.toolbar.copyFilePath')")
  })
})
