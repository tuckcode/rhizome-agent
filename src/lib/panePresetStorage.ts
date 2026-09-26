import { APP_STORAGE_KEYS } from '../constants/appStorage'
import { normalizedWidths, PANE_PRESET_IDS, type PanePresetId, type PanePresetState } from './panePresets'

export type PanePresetPreferences = {
  version: 1
  active: PanePresetState
  savedWidths: Partial<Record<PanePresetId, PanePresetState['widths']>>
}

export function panePresetStorageKey(scope: string): string {
  return `${APP_STORAGE_KEYS.panePresets}:${scope}`
}

export function loadPanePreferences(scope: string): PanePresetPreferences {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(panePresetStorageKey(scope)) ?? 'null')
    if (raw && typeof raw === 'object' && 'version' in raw && raw.version === 1 && 'active' in raw) {
      const active = parsePreset(raw.active)
      if (active) {
        const savedWidths: PanePresetPreferences['savedWidths'] = {}
        if ('savedWidths' in raw && raw.savedWidths && typeof raw.savedWidths === 'object') {
          for (const id of PANE_PRESET_IDS) {
            const widths: unknown = Reflect.get(raw.savedWidths, id)
            if (widths && typeof widths === 'object') savedWidths[id] = normalizedWidths(widths)
          }
        }
        return { version: 1, active, savedWidths }
      }
    }
  } catch { /* Missing or damaged storage is a Chat launch. Leftover view_mode is not a preset. */ }
  return { version: 1, active: { id: 'chat', widths: {} }, savedWidths: {} }
}

function parsePreset(raw: unknown): PanePresetState | null {
  if (!raw || typeof raw !== 'object' || !('id' in raw) || !PANE_PRESET_IDS.some(id => id === raw.id)) return null
  const id = PANE_PRESET_IDS.find(id => id === raw.id)!
  const widths = 'widths' in raw && raw.widths && typeof raw.widths === 'object' ? normalizedWidths(raw.widths) : {}
  return {
    id,
    widths,
    readNotes: 'readNotes' in raw && raw.readNotes === true,
    ...('stacked' in raw && raw.stacked === true ? { stacked: true } : {}),
  }
}

export function savePanePreferences(scope: string, preferences: PanePresetPreferences): void {
  try { localStorage.setItem(panePresetStorageKey(scope), JSON.stringify(preferences)) }
  catch { /* A refused write does not prevent changing the layout. */ }
}
