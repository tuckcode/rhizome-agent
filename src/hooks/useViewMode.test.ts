import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useViewMode } from './useViewMode'
import { bindVaultConfigStore, getVaultConfig, resetVaultConfigStore } from '../utils/vaultConfigStore'

vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
}))

describe('useViewMode', () => {
  beforeEach(() => {
    resetVaultConfigStore()
    bindVaultConfigStore(
      { zoom: null, view_mode: null, editor_mode: null, tag_colors: null, status_colors: null, property_display_modes: null },
      vi.fn(),
    )
  })

  it('defaults to "all" when no stored value', () => {
    const { result } = renderHook(() => useViewMode())
    expect(result.current.viewMode).toBe('all')
    expect(result.current.sidebarVisible).toBe(true)
    expect(result.current.noteListVisible).toBe(true)
  })

  it('loads persisted view mode from vault config', () => {
    resetVaultConfigStore()
    bindVaultConfigStore(
      { zoom: null, view_mode: 'editor-only', editor_mode: null, tag_colors: null, status_colors: null, property_display_modes: null },
      vi.fn(),
    )
    const { result } = renderHook(() => useViewMode())
    expect(result.current.viewMode).toBe('editor-only')
    expect(result.current.sidebarVisible).toBe(false)
    expect(result.current.noteListVisible).toBe(false)
  })

  it('setViewMode updates state and persists to vault config', () => {
    const { result } = renderHook(() => useViewMode())
    act(() => result.current.setViewMode('editor-list'))
    expect(result.current.viewMode).toBe('editor-list')
    expect(result.current.sidebarVisible).toBe(false)
    expect(result.current.noteListVisible).toBe(true)
    expect(getVaultConfig().view_mode).toBe('editor-list')
  })

  it('editor-only hides both sidebar and note list', () => {
    const { result } = renderHook(() => useViewMode())
    act(() => result.current.setViewMode('editor-only'))
    expect(result.current.sidebarVisible).toBe(false)
    expect(result.current.noteListVisible).toBe(false)
  })

  it('editor-list hides sidebar but shows note list', () => {
    const { result } = renderHook(() => useViewMode())
    act(() => result.current.setViewMode('editor-list'))
    expect(result.current.sidebarVisible).toBe(false)
    expect(result.current.noteListVisible).toBe(true)
  })

  it('all mode shows both sidebar and note list', () => {
    const { result } = renderHook(() => useViewMode())
    act(() => result.current.setViewMode('editor-only'))
    act(() => result.current.setViewMode('all'))
    expect(result.current.sidebarVisible).toBe(true)
    expect(result.current.noteListVisible).toBe(true)
  })

  it('ignores invalid vault config values', () => {
    resetVaultConfigStore()
    bindVaultConfigStore(
      { zoom: null, view_mode: 'garbage' as never, editor_mode: null, tag_colors: null, status_colors: null, property_display_modes: null },
      vi.fn(),
    )
    const { result } = renderHook(() => useViewMode())
    expect(result.current.viewMode).toBe('all')
  })
})
