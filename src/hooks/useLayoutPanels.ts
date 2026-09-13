import { useCallback, useEffect, useState } from 'react'
import { APP_STORAGE_KEYS, LEGACY_APP_STORAGE_KEYS, getAppStorageItem } from '../constants/appStorage'
import { COMMAND_RAIL_EXPANDED_WIDTH_PX } from '../utils/trafficLights'

export const COLUMN_MIN_WIDTHS = {
  // 250px floor keeps the sidebar brand lockup (mark + wordmark) from
  // clipping — must stay in sync with .app__sidebar min-width in App.css.
  sidebar: 250,
  noteList: 220,
  editor: 800,
  inspector: 240,
  graphPreview: 280,
} as const

const COLUMN_MAX_WIDTHS = {
  sidebar: 400,
  noteList: 500,
  inspector: 500,
  graphPreview: 560,
} as const

const DEFAULT_PANEL_WIDTHS = {
  sidebar: 250,
  noteList: COMMAND_RAIL_EXPANDED_WIDTH_PX,
  inspector: 280,
  graphPreview: 340,
} as const

/** Previous Notes default before the column mirrored the Sessions rail. */
const LEGACY_NOTE_LIST_DEFAULT_WIDTH = 300

type PanelWidthKey = keyof typeof DEFAULT_PANEL_WIDTHS
type PanelWidths = Record<PanelWidthKey, number>

function defaultPanelWidths(): PanelWidths {
  return { ...DEFAULT_PANEL_WIDTHS }
}

function clampPanelWidth(key: PanelWidthKey, value: number): number {
  const minWidth = Reflect.get(COLUMN_MIN_WIDTHS, key) as number
  const maxWidth = Reflect.get(COLUMN_MAX_WIDTHS, key) as number
  return Math.max(minWidth, Math.min(maxWidth, value))
}

function isPanelWidthRecord(value: unknown): value is Partial<Record<PanelWidthKey, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readPanelWidth(source: Partial<Record<PanelWidthKey, unknown>>, key: PanelWidthKey): number {
  const value = Reflect.get(source, key)
  const fallback = Reflect.get(DEFAULT_PANEL_WIDTHS, key) as number
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  const width = clampPanelWidth(key, value)
  if (key === 'noteList' && width === LEGACY_NOTE_LIST_DEFAULT_WIDTH) {
    return DEFAULT_PANEL_WIDTHS.noteList
  }
  return width
}

function normalizePanelWidths(value: unknown): PanelWidths {
  if (!isPanelWidthRecord(value)) return defaultPanelWidths()
  return {
    sidebar: readPanelWidth(value, 'sidebar'),
    noteList: readPanelWidth(value, 'noteList'),
    inspector: readPanelWidth(value, 'inspector'),
    graphPreview: readPanelWidth(value, 'graphPreview'),
  }
}

function loadPanelWidths(): PanelWidths {
  const raw = getAppStorageItem('layoutPanels')
  if (!raw) return defaultPanelWidths()

  try {
    return normalizePanelWidths(JSON.parse(raw))
  } catch {
    return defaultPanelWidths()
  }
}

function savePanelWidths(widths: PanelWidths): void {
  try {
    localStorage.setItem(APP_STORAGE_KEYS.layoutPanels, JSON.stringify(widths))
    localStorage.removeItem(LEGACY_APP_STORAGE_KEYS.layoutPanels)
  } catch {
    // Ignore unavailable or restricted localStorage implementations.
  }
}

export function useLayoutPanels(options?: { initialInspectorCollapsed?: boolean }) {
  const [panelWidths, setPanelWidths] = useState(loadPanelWidths)
  const [inspectorCollapsed, setInspectorCollapsed] = useState(options?.initialInspectorCollapsed ?? true)

  useEffect(() => {
    savePanelWidths(panelWidths)
  }, [panelWidths])

  const resizePanel = useCallback((key: PanelWidthKey, delta: number) => {
    setPanelWidths((widths) => {
      const nextWidths = { ...widths }
      const currentWidth = Reflect.get(widths, key) as number
      Reflect.set(nextWidths, key, clampPanelWidth(key, currentWidth + delta))
      return nextWidths
    })
  }, [])

  const handleSidebarResize = useCallback((delta: number) => resizePanel('sidebar', delta), [resizePanel])
  const handleNoteListResize = useCallback((delta: number) => resizePanel('noteList', delta), [resizePanel])
  const handleInspectorResize = useCallback((delta: number) => resizePanel('inspector', -delta), [resizePanel])
  // Right-hand panel: dragging the handle left (negative delta) should grow it.
  const handleGraphPreviewResize = useCallback((delta: number) => resizePanel('graphPreview', -delta), [resizePanel])

  return {
    sidebarWidth: panelWidths.sidebar,
    noteListWidth: panelWidths.noteList,
    inspectorWidth: panelWidths.inspector,
    graphPreviewWidth: panelWidths.graphPreview,
    inspectorCollapsed,
    setInspectorCollapsed,
    handleSidebarResize,
    handleNoteListResize,
    handleInspectorResize,
    handleGraphPreviewResize,
  }
}
