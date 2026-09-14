import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/src/shared/appCommandManifest.json`,
  'utf8',
)

describe('leftover Cmd+N new note', () => {
  it('locks fileNewNote to CmdOrCtrl+N', () => {
    expect(source).toContain('"fileNewNote"')
    expect(source).toContain('"accelerator": "CmdOrCtrl+N"')
  })
})
