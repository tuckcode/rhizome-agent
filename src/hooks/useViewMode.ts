import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { APP_STORAGE_KEYS } from '../constants/appStorage'
import { getVaultConfig, updateVaultConfigField, subscribeVaultConfig } from '../utils/vaultConfigStore'
import { presetFromLegacy, presetToLegacy, type PanePresetId, type PanePresetState } from '../lib/panePresets'
import { loadPanePreferences, savePanePreferences, type PanePresetPreferences } from '../lib/panePresetStorage'
import { trackEvent } from '../lib/telemetry'

export type ViewMode = 'editor-only' | 'editor-list' | 'all'

function preferencesForScope(initialOverride: ViewMode | undefined, storageScope: string): PanePresetPreferences {
  return initialOverride
    ? { version: 1, active: presetFromLegacy(initialOverride, 'stacked'), savedWidths: {} }
    : loadPanePreferences(storageScope)
}

export function useViewMode(initialOverride?: ViewMode, storageScope = '') {
  const [edited, setEdited] = useState<{ scope: string; prefs: PanePresetPreferences } | null>(null)
  const stored = useMemo(
    () => preferencesForScope(initialOverride, storageScope),
    [initialOverride, storageScope],
  )
  const preferences = edited?.scope === storageScope ? edited.prefs : stored
  const current = useRef(preferences)
  const lastMode = useRef(getVaultConfig().view_mode)
  useEffect(() => { current.current = preferences }, [preferences])
  const apply = useCallback((next: PanePresetPreferences) => {
    current.current = next
    setEdited({ scope: storageScope, prefs: next })
    if (!initialOverride) savePanePreferences(storageScope, next)
  }, [initialOverride, storageScope])

  useEffect(() => {
    lastMode.current = getVaultConfig().view_mode
    return subscribeVaultConfig(() => {
      const mode = getVaultConfig().view_mode
      // Null is also the store's transient reset during a vault switch.
      if (initialOverride || mode == null || mode === lastMode.current) return
      lastMode.current = mode
      if (mode === presetToLegacy(current.current.active).viewMode) return
      const next = presetFromLegacy(mode === 'all' || mode === 'editor-list' ? mode : 'editor-only', 'stacked')
      apply({ ...current.current, active: { ...next, widths: current.current.savedWidths[next.id] ?? {} } })
    })
  }, [apply, initialOverride, storageScope])

  const setPanePreset = useCallback((id: PanePresetId) => {
    const previous = current.current
    const active: PanePresetState = { id, widths: previous.savedWidths[id] ?? {} }
    apply({ ...previous, active })
    const legacy = presetToLegacy(active)
    lastMode.current = legacy.viewMode
    if (!initialOverride) {
      updateVaultConfigField('view_mode', legacy.viewMode)
      try { localStorage.setItem(APP_STORAGE_KEYS.chatNoteSplit, legacy.split) } catch { /* Optional compatibility mirror. */ }
    }
    trackEvent('pane_preset_changed', { preset: id })
  }, [apply, initialOverride])

  const setViewMode = useCallback((mode: ViewMode) => {
    setPanePreset(presetFromLegacy(mode, 'stacked').id)
  }, [setPanePreset])

  const updatePanePreset = useCallback((active: PanePresetState) => {
    apply({ ...current.current, active, savedWidths: { ...current.current.savedWidths, [active.id]: active.widths } })
  }, [apply])

  const resetPaneLayout = useCallback(() => {
    apply({ version: 1, active: { id: 'chat', widths: {} }, savedWidths: {} })
    lastMode.current = 'editor-only'
    if (!initialOverride) {
      updateVaultConfigField('view_mode', 'editor-only')
      try { localStorage.setItem(APP_STORAGE_KEYS.chatNoteSplit, 'stacked') } catch { /* Optional compatibility mirror. */ }
    }
    trackEvent('pane_layout_reset')
  }, [apply, initialOverride])

  const viewMode = presetToLegacy(preferences.active).viewMode
  return {
    viewMode, setViewMode, panePreset: preferences.active, setPanePreset, updatePanePreset, resetPaneLayout,
    sidebarVisible: viewMode === 'all', noteListVisible: viewMode !== 'editor-only',
  }
}
