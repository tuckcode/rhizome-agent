import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/src/components/PrimeSessionList.tsx`,
  'utf8',
)

describe('leftover sessions drag', () => {
  it('locks useDragRegion on the sessions list title bar', () => {
    expect(source).toContain('useDragRegion<HTMLDivElement>()')
  })
})
