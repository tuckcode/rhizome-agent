import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/src/hooks/commands/noteCommands.ts`,
  'utf8',
)

describe('leftover New Note', () => {
  it("locks id: 'create-note'", () => {
    expect(source).toContain("id: 'create-note'")
  })

  it("locks label: 'New Note'", () => {
    expect(source).toContain("label: 'New Note'")
  })

  it('locks APP_COMMAND_IDS.fileNewNote', () => {
    expect(source).toContain('APP_COMMAND_IDS.fileNewNote')
  })
})
