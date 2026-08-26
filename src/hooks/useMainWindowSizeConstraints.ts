import { useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isWindows } from '../utils/platform'

const MAIN_WINDOW_MIN_HEIGHT = 400
const EDITOR_ONLY_MAIN_WINDOW_MIN_WIDTH = 480
const CHAT_CENTERED_MAIN_WINDOW_MIN_WIDTH = 760
const MAIN_WINDOW_SIDEBAR_MIN_WIDTH = 220
const MAIN_WINDOW_NOTE_LIST_MIN_WIDTH = 220
const MAIN_WINDOW_INSPECTOR_MIN_WIDTH = 240

export type MainWindowPaneVisibility = {
  sidebarVisible: boolean
  noteListVisible: boolean
  inspectorCollapsed: boolean
  sidebarWidth?: number
  noteListWidth?: number
  inspectorWidth?: number
  unifiedVaultPanel?: boolean
}

export function getMainWindowMinWidth({
  sidebarVisible,
  noteListVisible,
  inspectorCollapsed,
  sidebarWidth,
  noteListWidth,
  inspectorWidth,
  unifiedVaultPanel = false,
}: MainWindowPaneVisibility): number {
  let minWidth = unifiedVaultPanel
    ? CHAT_CENTERED_MAIN_WINDOW_MIN_WIDTH
    : EDITOR_ONLY_MAIN_WINDOW_MIN_WIDTH

  // The chat-centered shell has one adaptive vault panel. It collapses before
  // the core Chat + editor split becomes unusable, so it must not raise the
  // native minimum or force a window resize merely because a tab is open.
  if (!unifiedVaultPanel) {
    if (sidebarVisible) minWidth += getPaneWidth(sidebarWidth, MAIN_WINDOW_SIDEBAR_MIN_WIDTH)
    if (noteListVisible) minWidth += getPaneWidth(noteListWidth, MAIN_WINDOW_NOTE_LIST_MIN_WIDTH)
  }
  if (!inspectorCollapsed) minWidth += getPaneWidth(inspectorWidth, MAIN_WINDOW_INSPECTOR_MIN_WIDTH)

  return minWidth
}

function getPaneWidth(width: number | undefined, minimum: number): number {
  return typeof width === 'number' && Number.isFinite(width)
    ? Math.max(minimum, Math.round(width))
    : minimum
}

type MainWindowSizeConstraintsOptions = MainWindowPaneVisibility & {
  enabled?: boolean
}

export async function applyMainWindowSizeConstraints(
  minWidth: number,
  options: { growToFit?: boolean } = {},
): Promise<void> {
  await invoke('update_current_window_min_size', {
    minWidth,
    minHeight: MAIN_WINDOW_MIN_HEIGHT,
    growToFit: options.growToFit ?? true,
  })
}

export function useMainWindowSizeConstraints({
  enabled = true,
  sidebarVisible,
  noteListVisible,
  inspectorCollapsed,
  sidebarWidth,
  noteListWidth,
  inspectorWidth,
  unifiedVaultPanel = false,
}: MainWindowSizeConstraintsOptions): void {
  const minWidth = getMainWindowMinWidth({
    sidebarVisible,
    noteListVisible,
    inspectorCollapsed,
    sidebarWidth,
    noteListWidth,
    inspectorWidth,
    unifiedVaultPanel,
  })

  useEffect(() => {
    if (!enabled) return

    let cancelled = false

    void (async () => {
      if (cancelled) return
      await applyMainWindowSizeConstraints(minWidth, { growToFit: !isWindows() })
    })().catch((err) => console.warn('[window] Size constraints failed:', err))

    return () => {
      cancelled = true
    }
  }, [enabled, minWidth])
}
