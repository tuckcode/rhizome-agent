import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/src/components/ConnectionsPanel.tsx`,
  'utf8',
)

describe('leftover overflow isolate', () => {
  it('locks overflow-hidden isolate on the Connections panel', () => {
    expect(source).toContain('overflow-hidden isolate')
  })
})
