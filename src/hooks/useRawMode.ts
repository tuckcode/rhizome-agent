import { useState, useCallback, useEffect } from 'react'
import { getVaultConfig, updateVaultConfigField, subscribeVaultConfig } from '../utils/vaultConfigStore'
import { trackEvent } from '../lib/telemetry'

interface UseRawModeParams {
  activeTabPath: string | null
  /** Flush pending WYSIWYG edits to disk before entering raw mode. */
  onFlushPending?: () => Promise<boolean>
  /** Called synchronously before raw mode is deactivated, so the caller can
   *  flush any debounced raw-editor content into tab state. */
  onBeforeRawEnd?: () => void
}

function loadEditorMode(): boolean {
  return getVaultConfig().editor_mode === 'raw'
}

/**
 * Manages raw editor mode state.
 * The mode preference persists across tab switches and is stored in vault config.
 */
export function useRawMode({ activeTabPath, onFlushPending, onBeforeRawEnd }: UseRawModeParams) {
  const [rawEnabled, setRawEnabled] = useState(loadEditorMode)

  // Re-sync when vault config becomes available (e.g. after initial load)
  useEffect(() => {
    return subscribeVaultConfig(() => {
      const stored = getVaultConfig().editor_mode
      setRawEnabled(stored === 'raw')
    })
  }, [])

  const rawMode = rawEnabled && activeTabPath !== null

  const handleToggleRaw = useCallback(async () => {
    trackEvent('raw_mode_toggled')
    if (rawEnabled) {
      onBeforeRawEnd?.()
      setRawEnabled(false)
      updateVaultConfigField('editor_mode', 'preview')
    } else {
      await onFlushPending?.()
      setRawEnabled(true)
      updateVaultConfigField('editor_mode', 'raw')
    }
  }, [rawEnabled, onFlushPending, onBeforeRawEnd])

  return { rawMode, handleToggleRaw }
}
