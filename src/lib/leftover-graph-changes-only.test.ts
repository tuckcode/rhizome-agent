import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover graph changes only', () => {
  const app = readFileSync(`${process.cwd()}/src/App.tsx`, 'utf8')

  it('locks Graph/Mycelium Connections on Changes', () => {
    expect(app).toContain('chatCentered && isChangesSelection ? (')
  })

  it('does not mount GraphView from Inbox', () => {
    expect(app).not.toMatch(/isInboxSelection[\s\S]{0,80}GraphView/)
  })
})
