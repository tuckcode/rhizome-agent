import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover linux drag region', () => {
  const source = readFileSync(
    `${process.cwd()}/src/components/LinuxTitlebar.tsx`,
    'utf8',
  )

  it('locks useDragRegion on the Linux titlebar', () => {
    expect(source).toContain('useDragRegion')
  })

  it('locks dragRegionRef from useDragRegion<HTMLDivElement>', () => {
    expect(source).toContain(
      'const { dragRegionRef } = useDragRegion<HTMLDivElement>()',
    )
  })
})
