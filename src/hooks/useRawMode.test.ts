import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRawMode } from './useRawMode'
import * as store from '../utils/vaultConfigStore'

describe('useRawMode', () => {
  let onFlushPending: ReturnType<typeof vi.fn>

  beforeEach(() => {
    onFlushPending = vi.fn().mockResolvedValue(true)
    // Reset vault config to defaults before each test
    store.resetVaultConfigStore()
    store.bindVaultConfigStore(
      { zoom: null, view_mode: null, editor_mode: null, tag_colors: null, status_colors: null, property_display_modes: null },
      vi.fn(),
    )
  })

  afterEach(() => {
    store.resetVaultConfigStore()
  })

  function renderRawHook(activeTabPath: string | null = '/note.md') {
    return renderHook(
      ({ path }) => useRawMode({ activeTabPath: path, onFlushPending }),
      { initialProps: { path: activeTabPath } },
    )
  }

  it('starts with raw mode off', () => {
    const { result } = renderRawHook()
    expect(result.current.rawMode).toBe(false)
  })

  it('toggles raw mode on', async () => {
    const { result } = renderRawHook()

    await act(async () => { await result.current.handleToggleRaw() })

    expect(result.current.rawMode).toBe(true)
  })

  it('flushes pending edits when activating raw mode', async () => {
    const { result } = renderRawHook()

    await act(async () => { await result.current.handleToggleRaw() })

    expect(onFlushPending).toHaveBeenCalledOnce()
  })

  it('does not flush pending edits when deactivating raw mode', async () => {
    const { result } = renderRawHook()

    await act(async () => { await result.current.handleToggleRaw() })
    onFlushPending.mockClear()

    await act(async () => { await result.current.handleToggleRaw() })

    expect(onFlushPending).not.toHaveBeenCalled()
  })

  it('toggles raw mode off when already on', async () => {
    const { result } = renderRawHook()

    await act(async () => { await result.current.handleToggleRaw() })
    expect(result.current.rawMode).toBe(true)

    await act(async () => { await result.current.handleToggleRaw() })
    expect(result.current.rawMode).toBe(false)
  })

  it('persists raw mode across tab switches', async () => {
    const { result, rerender } = renderRawHook('/note-a.md')

    await act(async () => { await result.current.handleToggleRaw() })
    expect(result.current.rawMode).toBe(true)

    rerender({ path: '/note-b.md' })
    expect(result.current.rawMode).toBe(true)
  })

  it('works without onFlushPending callback', async () => {
    const { result } = renderHook(() => useRawMode({ activeTabPath: '/note.md' }))

    await act(async () => { await result.current.handleToggleRaw() })

    expect(result.current.rawMode).toBe(true)
  })

  it('does not activate raw mode when activeTabPath is null', async () => {
    const { result } = renderRawHook(null)

    await act(async () => { await result.current.handleToggleRaw() })

    // rawMode is false because there's no active tab, even though preference is enabled
    expect(result.current.rawMode).toBe(false)
  })

  it('calls onBeforeRawEnd when deactivating raw mode', async () => {
    const onBeforeRawEnd = vi.fn()
    const { result } = renderHook(
      ({ path }) => useRawMode({ activeTabPath: path, onFlushPending, onBeforeRawEnd }),
      { initialProps: { path: '/note.md' } },
    )

    await act(async () => { await result.current.handleToggleRaw() })
    expect(result.current.rawMode).toBe(true)

    await act(async () => { await result.current.handleToggleRaw() })

    expect(onBeforeRawEnd).toHaveBeenCalledOnce()
    expect(result.current.rawMode).toBe(false)
  })

  it('does not call onBeforeRawEnd when activating raw mode', async () => {
    const onBeforeRawEnd = vi.fn()
    const { result } = renderHook(
      ({ path }) => useRawMode({ activeTabPath: path, onFlushPending, onBeforeRawEnd }),
      { initialProps: { path: '/note.md' } },
    )

    await act(async () => { await result.current.handleToggleRaw() })

    expect(onBeforeRawEnd).not.toHaveBeenCalled()
  })

  it('persists editor_mode to vault config on toggle', async () => {
    const saveFn = vi.fn()
    store.resetVaultConfigStore()
    store.bindVaultConfigStore(
      { zoom: null, view_mode: null, editor_mode: null, tag_colors: null, status_colors: null, property_display_modes: null },
      saveFn,
    )

    const { result } = renderRawHook()

    await act(async () => { await result.current.handleToggleRaw() })
    expect(store.getVaultConfig().editor_mode).toBe('raw')

    await act(async () => { await result.current.handleToggleRaw() })
    expect(store.getVaultConfig().editor_mode).toBe('preview')
  })

  it('restores raw mode from vault config on init', () => {
    store.resetVaultConfigStore()
    store.bindVaultConfigStore(
      { zoom: null, view_mode: null, editor_mode: 'raw', tag_colors: null, status_colors: null, property_display_modes: null },
      vi.fn(),
    )

    const { result } = renderRawHook()
    expect(result.current.rawMode).toBe(true)
  })
})
