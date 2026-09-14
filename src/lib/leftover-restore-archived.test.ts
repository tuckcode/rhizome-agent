import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/src/components/PrimeSessionListContextMenu.tsx`,
  'utf8',
)

describe('leftover restore archived session', () => {
  it('locks restore calling onSetArchived with false', () => {
    expect(source).toContain('onSetArchived(session, false)')
  })
})
