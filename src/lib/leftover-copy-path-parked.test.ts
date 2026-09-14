import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover copy path parked', () => {
  it('does not invent selected-text Copy path on the note editor', () => {
    const editor = readFileSync(`${process.cwd()}/src/components/Editor.tsx`, 'utf8')
    const single = readFileSync(
      `${process.cwd()}/src/components/SingleEditorView.tsx`,
      'utf8',
    )
    expect(editor).not.toMatch(/Copy path/)
    expect(single).not.toMatch(/Copy path/)
  })

  it('locks session-list Copy path', () => {
    const menu = readFileSync(
      `${process.cwd()}/src/components/PrimeSessionListContextMenu.tsx`,
      'utf8',
    )
    expect(menu).toContain("label: 'Copy path'")
  })
})
