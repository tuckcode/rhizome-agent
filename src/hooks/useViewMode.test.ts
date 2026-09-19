import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useViewMode } from './useViewMode'
import { bindVaultConfigStore, getVaultConfig, resetVaultConfigStore } from '../utils/vaultConfigStore'

vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
}))

describe('useViewMode', () => {
  beforeEach(() => {
    localStorage.clear()
    resetVaultConfigStore()
    bindVaultConfigStore(
      { zoom: null, view_mode: null, editor_mode: null, tag_colors: null, status_colors: null, property_display_modes: null },
      vi.fn(),
    )
  })

  it('defaults to Chat (editor-only) when no value is stored', () => {
    const { result } = renderHook(() => useViewMode())
    expect(result.current.viewMode).toBe('editor-only')
    expect(result.current.sidebarVisible).toBe(false)
    expect(result.current.noteListVisible).toBe(false)
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
    expect(result.current.viewMode).toBe('editor-only')
  })
  it('restores Read and its per-preset widths after a restart and config hydration', () => {
    const first = renderHook(() => useViewMode(undefined, 'vault-a'))
    act(() => first.result.current.setPanePreset('read'))
    act(() => first.result.current.updatePanePreset({ ...first.result.current.panePreset, widths: { note: 410 } }))
    act(() => first.result.current.setPanePreset('notes'))
    act(() => first.result.current.updatePanePreset({ ...first.result.current.panePreset, widths: { notes: 290 } }))
    act(() => first.result.current.setPanePreset('read'))
    expect(first.result.current.panePreset.widths.note).toBe(410)
    first.unmount()
    resetVaultConfigStore()
    const next = renderHook(() => useViewMode(undefined, 'vault-a'))
    expect(next.result.current.panePreset.id).toBe('read')
    act(() => bindVaultConfigStore({ ...getVaultConfig(), view_mode: 'editor-only' }, vi.fn()))
    expect(next.result.current.panePreset.id).toBe('read')
    expect(next.result.current.panePreset.widths.note).toBe(410)
    act(() => next.result.current.setPanePreset('notes'))
    expect(next.result.current.panePreset.widths.notes).toBe(290)
    act(() => next.result.current.resetPaneLayout())
    expect(next.result.current.panePreset).toEqual({ id: 'chat', widths: {} })
    act(() => next.result.current.setPanePreset('read'))
    expect(next.result.current.panePreset.widths).toEqual({})
  })

  it('keeps widths separate between vaults and tolerates damaged storage', () => {
    localStorage.setItem('rhizome:pane-presets:v1:vault-a', '{broken')
    const { result, rerender } = renderHook(({ scope }) => useViewMode(undefined, scope), { initialProps: { scope: 'vault-a' } })
    expect(result.current.panePreset.id).toBe('chat')
    act(() => result.current.updatePanePreset({ id: 'chat', widths: { rail: 300 } }))
    rerender({ scope: 'vault-b' })
    expect(result.current.panePreset.widths).toEqual({})
    rerender({ scope: 'vault-a' })
    expect(result.current.panePreset.widths.rail).toBe(300)
  })

})
