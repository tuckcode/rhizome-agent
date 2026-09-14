import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover browse command names', () => {
  it('locks command.view.editorNoteList as Notes, Browse closed', () => {
    const en = readFileSync(`${process.cwd()}/src/lib/locales/en.json`, 'utf8')
    expect(en).toContain('"command.view.editorNoteList": "Notes, Browse closed"')
  })

  it('locks command.view.fullLayout as Notes, Browse open', () => {
    const en = readFileSync(`${process.cwd()}/src/lib/locales/en.json`, 'utf8')
    expect(en).toContain('"command.view.fullLayout": "Notes, Browse open"')
  })
})
