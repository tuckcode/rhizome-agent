import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover editor no copy path', () => {
  it('does not invent selected-text Copy path on the note editor', () => {
    // Highlight-in-note Copy path is leftover. Session list already has
    // Copy path. Note list already has Copy file path. Do not invent a
    // third path this window.
    const editor = readFileSync(`${process.cwd()}/src/components/Editor.tsx`, 'utf8')
    const single = readFileSync(`${process.cwd()}/src/components/SingleEditorView.tsx`, 'utf8')
    expect(editor).not.toMatch(/Copy path/)
    expect(single).not.toMatch(/Copy path/)
  })
})
