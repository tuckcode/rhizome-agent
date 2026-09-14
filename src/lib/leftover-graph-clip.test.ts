import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/src/components/ConnectionsPanel.tsx`,
  'utf8',
)

describe('leftover graph clip', () => {
  it('locks the ConnectionsPanel clipPath inset style', () => {
    expect(source).toContain("style={{ clipPath: 'inset(0)' }}")
  })
})
