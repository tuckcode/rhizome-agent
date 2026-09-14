import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover archived session Restore', () => {
  it('locks Restore and Archive on the session context menu', () => {
    const menu = readFileSync(
      `${process.cwd()}/src/components/PrimeSessionListContextMenu.tsx`,
      'utf8',
    )
    expect(menu).toContain("label: 'Restore'")
    expect(menu).toContain("label: 'Archive'")
  })
})
