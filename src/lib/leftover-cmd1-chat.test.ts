import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/src/shared/appCommandManifest.json`,
  'utf8',
)

describe('leftover Cmd+1 Chat', () => {
  it('locks viewEditorOnly to CmdOrCtrl+1', () => {
    expect(source).toContain('"viewEditorOnly"')
    expect(source).toContain('"accelerator": "CmdOrCtrl+1"')
  })

  it('locks Cmd+1 as Chat', () => {
    expect(source).toContain('"label": "Chat"')
  })
})
