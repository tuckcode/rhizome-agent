import { describe, expect, it } from 'vitest'
import { readAppShellSource } from '../test-utils/appShellSource'

describe('leftover graph changes only', () => {
  const app = readAppShellSource()

  it('mounts Graph/Mycelium with Notes, not only on Changes', () => {
    expect(app).toContain('chatCentered ? (')
    expect(app).not.toContain('chatCentered && isChangesSelection ? (')
  })

  it('does not mount GraphView from Inbox', () => {
    expect(app).not.toMatch(/isInboxSelection[\s\S]{0,80}GraphView/)
  })
})
