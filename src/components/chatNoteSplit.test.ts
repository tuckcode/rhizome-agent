import { afterEach, describe, expect, it } from 'vitest'
import {
  parseChatNoteSplit,
  shouldForceChatShellCompact,
  useChatNoteSplit,
} from './chatNoteSplit'
import { APP_STORAGE_KEYS } from '../constants/appStorage'
import { renderHook, act } from '@testing-library/react'

describe('parseChatNoteSplit', () => {
  it('defaults to stacked so Sessions and Notes stay open', () => {
    expect(parseChatNoteSplit(null)).toBe('stacked')
    expect(parseChatNoteSplit('')).toBe('stacked')
    expect(parseChatNoteSplit('vertical')).toBe('stacked')
  })

  it('reads the side-by-side value that collapses the columns', () => {
    expect(parseChatNoteSplit('side-by-side')).toBe('side-by-side')
  })
})

describe('shouldForceChatShellCompact', () => {
  it('leaves Sessions and Notes in the row when the note sits on top', () => {
    expect(shouldForceChatShellCompact('stacked', true)).toBe(false)
  })

  it('collapses Sessions and Notes when a note sits beside Chat', () => {
    expect(shouldForceChatShellCompact('side-by-side', true)).toBe(true)
  })

  it('does not collapse columns when Chat has no open note', () => {
    expect(shouldForceChatShellCompact('side-by-side', false)).toBe(false)
  })
})

describe('useChatNoteSplit', () => {
  afterEach(() => {
    window.localStorage.removeItem(APP_STORAGE_KEYS.chatNoteSplit)
  })

  it('remembers the last layout across a restart', () => {
    window.localStorage.setItem(APP_STORAGE_KEYS.chatNoteSplit, 'side-by-side')
    const { result } = renderHook(() => useChatNoteSplit())
    expect(result.current.split).toBe('side-by-side')

    act(() => {
      result.current.setSplit('stacked')
    })
    expect(result.current.split).toBe('stacked')
    expect(window.localStorage.getItem(APP_STORAGE_KEYS.chatNoteSplit)).toBe('stacked')
  })
})
