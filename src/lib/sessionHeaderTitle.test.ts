import { describe, expect, it } from 'vitest'
import {
  collapseSessionTitle,
  sessionHeaderReport,
  sessionTitleRefreshKey,
} from './sessionHeaderTitle'

describe('collapseSessionTitle', () => {
  it('collapses whitespace and caps at 60 characters with an ellipsis', () => {
    const raw = 'Plan\n\nthe   launch of a very long session title that should not fill the header'
    expect(collapseSessionTitle(raw)).toBe(
      'Plan the launch of a very long session title that should not…',
    )
    expect([...collapseSessionTitle(raw)!].length).toBe(61)
  })

  it('returns null for blank titles', () => {
    expect(collapseSessionTitle('   \n  ')).toBeNull()
    expect(collapseSessionTitle(null)).toBeNull()
  })
})

describe('sessionHeaderReport', () => {
  it('uses the first user message when the path sources agree', () => {
    expect(sessionHeaderReport({
      activeSessionPath: 'rhizome-native:n1',
      nativeSessionId: 'n1',
      firstUserMessage: 'Explain this repo',
    })).toEqual({
      path: 'rhizome-native:n1',
      title: 'Explain this repo',
    })
  })

  it('does not report a new path while still holding another session', () => {
    expect(sessionHeaderReport({
      activeSessionPath: 'rhizome-native:new',
      nativeSessionId: 'old',
      firstUserMessage: 'Old chat title from leftover messages',
    })).toBeNull()
  })
})

describe('sessionTitleRefreshKey', () => {
  it('is a stable primitive for the same streaming flag and path', () => {
    expect(sessionTitleRefreshKey(true, '/a')).toBe(sessionTitleRefreshKey(true, '/a'))
    expect(sessionTitleRefreshKey(true, '/a')).not.toBe(sessionTitleRefreshKey(false, '/a'))
  })
})
