import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(`${process.cwd()}/src/App.tsx`, 'utf8')

describe('leftover width fold', () => {
  it('locks sessions auto-collapse when the window is compact', () => {
    expect(source).toContain('sessionsAutoCollapsed={compactSessions}')
  })
})
