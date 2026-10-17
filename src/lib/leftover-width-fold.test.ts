import { describe, expect, it } from 'vitest'
import { readAppShellSource } from '../test-utils/appShellSource'

const source = readAppShellSource()

describe('leftover width fold', () => {
  it('locks sessions auto-collapse when the window is compact', () => {
    expect(source).toContain('sessionsAutoCollapsed={compactSessions}')
  })
})
