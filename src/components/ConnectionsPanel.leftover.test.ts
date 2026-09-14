import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/src/components/ConnectionsPanel.tsx`,
  'utf8',
)

describe('ConnectionsPanel leftover', () => {
  it('clips the graph pane with inset(0)', () => {
    expect(source).toContain("style={{ clipPath: 'inset(0)' }}")
  })

  it('keeps the tab panel overflow-hidden isolate', () => {
    expect(source).toContain('overflow-hidden isolate')
  })

  it('has no connections-edge', () => {
    expect(source).not.toContain('connections-edge')
  })
})
