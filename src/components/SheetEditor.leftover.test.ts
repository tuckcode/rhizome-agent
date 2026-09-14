import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('SheetEditor leftover C68', () => {
  it('does not invent a sheet note lock or readOnly', () => {
    const sheet = readFileSync(
      `${process.cwd()}/src/components/SheetEditor.tsx`,
      'utf8',
    )
    expect(sheet).not.toContain('noteLocked')
    expect(sheet).not.toContain('readOnly')
  })
})
