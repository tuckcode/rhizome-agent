import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/src/shared/appCommandManifest.json`,
  'utf8',
)

describe('leftover Cmd+2 and Cmd+3', () => {
  it('locks CmdOrCtrl+2, CmdOrCtrl+3, and CmdOrCtrl+4 accelerators', () => {
    expect(source).toContain('"accelerator": "CmdOrCtrl+2"')
    expect(source).toContain('"accelerator": "CmdOrCtrl+3"')
    expect(source).toContain('"accelerator": "CmdOrCtrl+4"')
  })
})
