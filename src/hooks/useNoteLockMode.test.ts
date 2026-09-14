import { readFileSync } from 'node:fs'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useNoteLockMode } from './useNoteLockMode'

const trackNoteLockToggled = vi.hoisted(() => vi.fn())

vi.mock('../lib/productAnalytics', () => ({
  trackNoteLockToggled,
}))

describe('useNoteLockMode', () => {
  beforeEach(() => {
    trackNoteLockToggled.mockClear()
  })

  it('defaults to editable (unlocked) for any note path', () => {
    const { result } = renderHook(() => useNoteLockMode('/vault/a.md'))
    expect(result.current.noteLocked).toBe(false)
  })

  it('toggles lock for the active path and emits analytics without note content', () => {
    const { result } = renderHook(() => useNoteLockMode('/vault/a.md'))

    act(() => {
      result.current.onToggleNoteLock()
    })

    expect(result.current.noteLocked).toBe(true)
    expect(trackNoteLockToggled).toHaveBeenCalledExactlyOnceWith(true)

    act(() => {
      result.current.onToggleNoteLock()
    })

    expect(result.current.noteLocked).toBe(false)
    expect(trackNoteLockToggled).toHaveBeenLastCalledWith(false)
  })

  it('keeps lock state per path so a new note stays editable', () => {
    const { result, rerender } = renderHook(
      ({ path }: { path: string | null }) => useNoteLockMode(path),
      { initialProps: { path: '/vault/a.md' } },
    )

    act(() => {
      result.current.onToggleNoteLock()
    })
    expect(result.current.noteLocked).toBe(true)

    rerender({ path: '/vault/b.md' })
    expect(result.current.noteLocked).toBe(false)

    rerender({ path: '/vault/a.md' })
    expect(result.current.noteLocked).toBe(true)
  })

  it('no-ops toggle when there is no active note', () => {
    const { result } = renderHook(() => useNoteLockMode(null))
    act(() => {
      result.current.onToggleNoteLock()
    })
    expect(result.current.noteLocked).toBe(false)
    expect(trackNoteLockToggled).not.toHaveBeenCalled()
  })

  it('publishes toggle into an optional command ref', () => {
    const toggleRef = { current: (() => {}) as () => void }
    const { result } = renderHook(() => useNoteLockMode('/vault/a.md', toggleRef))

    act(() => {
      toggleRef.current()
    })

    expect(result.current.noteLocked).toBe(true)
    expect(trackNoteLockToggled).toHaveBeenCalledExactlyOnceWith(true)
  })

  it('stays ephemeral view state — not vault editor_mode', () => {
    const source = readFileSync(`${process.cwd()}/src/hooks/useNoteLockMode.ts`, 'utf8')
    expect(source).toContain('Not vault `editor_mode`')
    expect(source).not.toMatch(/invoke\(/)
    expect(source).not.toMatch(/localStorage/)
  })
})
