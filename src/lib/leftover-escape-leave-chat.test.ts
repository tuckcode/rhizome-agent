import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  `${process.cwd()}/src/components/ChatHome.tsx`,
  'utf8',
)

describe('ChatHome leftover Escape leaves Chat', () => {
  it('wires Escape leave through onClose={onExit}', () => {
    expect(source).toContain('onClose={onExit}')
  })
})
