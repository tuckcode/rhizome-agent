import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/src/components/ConnectionsPanel.tsx`,
  'utf8',
)

describe('leftover connections edge', () => {
  it('keeps connections-edge out of ConnectionsPanel', () => {
    expect(source).not.toContain('connections-edge')
  })
})
