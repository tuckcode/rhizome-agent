import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover Ask the agent about this note', () => {
  it('locks command.note.askAgent on the existing locale key', () => {
    const en = readFileSync(`${process.cwd()}/src/lib/locales/en.json`, 'utf8')
    expect(en).toContain(
      '"command.note.askAgent": "Ask the agent about this note"',
    )
  })

  it('locks the ChatHome requested-note comment', () => {
    const chatHome = readFileSync(
      `${process.cwd()}/src/components/ChatHome.tsx`,
      'utf8',
    )
    expect(chatHome).toContain('the vault\'s "Ask the agent about this')
  })
})
