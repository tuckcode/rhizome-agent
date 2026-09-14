import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover drag 4px threshold', () => {
  const source = readFileSync(
    `${process.cwd()}/src/hooks/useDragRegion.ts`,
    'utf8',
  )

  it('locks the 4px drag-start distance', () => {
    expect(source).toContain('const DRAG_DISTANCE_PX = 4')
  })

  it('locks drag start after pointer move', () => {
    expect(source).toContain('Drag starts only after the pointer moves')
  })
})
