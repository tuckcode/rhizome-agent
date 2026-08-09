import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useFeatureFlag } from './useFeatureFlag'

describe('useFeatureFlag', () => {
  it('returns true for shell_command_rail by default (network shell on)', () => {
    vi.spyOn(globalThis, 'localStorage', 'get').mockReturnValue({
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      length: 0,
      key: () => null,
    })
    const { result } = renderHook(() => useFeatureFlag('shell_command_rail'))
    expect(result.current).toBe(true)
    vi.restoreAllMocks()
  })

  it('returns true when localStorage override is set to "true"', () => {
    vi.spyOn(globalThis, 'localStorage', 'get').mockReturnValue({
      getItem: (key: string) => key === 'ff_shell_command_rail' ? 'true' : null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      length: 0,
      key: () => null,
    })
    const { result } = renderHook(() => useFeatureFlag('shell_command_rail'))
    expect(result.current).toBe(true)
    vi.restoreAllMocks()
  })

  it('returns false when localStorage override is set to "false" (classic UI)', () => {
    vi.spyOn(globalThis, 'localStorage', 'get').mockReturnValue({
      getItem: (key: string) => key === 'ff_shell_command_rail' ? 'false' : null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      length: 0,
      key: () => null,
    })
    const { result } = renderHook(() => useFeatureFlag('shell_command_rail'))
    expect(result.current).toBe(false)
    vi.restoreAllMocks()
  })

  it('ignores non-boolean localStorage values (treats as false)', () => {
    vi.spyOn(globalThis, 'localStorage', 'get').mockReturnValue({
      getItem: (key: string) => key === 'ff_shell_command_rail' ? 'maybe' : null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      length: 0,
      key: () => null,
    })
    const { result } = renderHook(() => useFeatureFlag('shell_command_rail'))
    expect(result.current).toBe(false)
    vi.restoreAllMocks()
  })

  it('falls back to default ON when localStorage throws', () => {
    vi.spyOn(globalThis, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('localStorage disabled')
    })
    const { result } = renderHook(() => useFeatureFlag('shell_command_rail'))
    expect(result.current).toBe(true)
    vi.restoreAllMocks()
  })
})
