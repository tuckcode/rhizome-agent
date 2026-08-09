import { APP_STORAGE_KEYS, copyLegacyAppStorageKeys, getAppStorageItem } from '../constants/appStorage'
import type { VaultConfig } from '../types'

const MIGRATION_FLAG = APP_STORAGE_KEYS.configMigrationFlag

/** Keys to migrate from localStorage to vault config file. */
const LS_KEYS = {
  zoom: APP_STORAGE_KEYS.zoom,
  viewMode: APP_STORAGE_KEYS.viewMode,
  tagColors: APP_STORAGE_KEYS.tagColors,
  statusColors: APP_STORAGE_KEYS.statusColors,
  propertyModes: APP_STORAGE_KEYS.propertyModes,
} as const

type JsonRecordConfigKey = 'tag_colors' | 'status_colors' | 'property_display_modes'

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) as T : null
  } catch {
    return null
  }
}

function createDefaultVaultConfig(): VaultConfig {
  return {
    zoom: null,
    view_mode: null,
    editor_mode: null,
    git_setup_preference: 'prompt',
    tag_colors: null,
    status_colors: null,
    property_display_modes: null,
    inbox: null,
  }
}

function migrationAlreadyCompleted(): boolean {
  try {
    return localStorage.getItem(MIGRATION_FLAG) === '1'
  } catch {
    return true
  }
}

function markMigrationCompleted() {
  try {
    localStorage.setItem(MIGRATION_FLAG, '1')
  } catch {
    // Ignore localStorage failures; the loaded config remains usable.
  }
}

function applyZoomMigration(result: VaultConfig) {
  if (result.zoom !== null) return
  try {
    const raw = getAppStorageItem('zoom')
    const value = raw === null ? null : Number(raw)
    if (value !== null && value >= 80 && value <= 150) result.zoom = value / 100
  } catch {
    // Ignore malformed legacy values.
  }
}

function applyViewModeMigration(result: VaultConfig) {
  if (result.view_mode !== null) return
  try {
    const raw = getAppStorageItem('viewMode')
    if (raw === 'editor-only' || raw === 'editor-list' || raw === 'all') result.view_mode = raw
  } catch {
    // Ignore malformed legacy values.
  }
}

function hasRecordValues(value: Record<string, string> | null): value is Record<string, string> {
  return value !== null && Object.keys(value).length > 0
}

function applyJsonRecordMigration(
  result: VaultConfig,
  field: JsonRecordConfigKey,
  primaryKey: string,
  legacyKey: string,
) {
  if (result[field] !== null) return
  const values = readJson<Record<string, string>>(primaryKey) ?? readJson<Record<string, string>>(legacyKey)
  if (hasRecordValues(values)) result[field] = values
}

/**
 * One-time migration: read localStorage values and merge into vault config.
 * Returns the merged config. If already migrated (flag set), returns the loaded config unchanged.
 * Passing null for `loaded` means the vault file didn't exist yet.
 */
export function migrateLocalStorageToVaultConfig(loaded: VaultConfig | null): VaultConfig {
  const base = loaded ?? createDefaultVaultConfig()

  copyLegacyAppStorageKeys()

  if (migrationAlreadyCompleted()) return base

  const result = { ...base }

  applyZoomMigration(result)
  applyViewModeMigration(result)
  applyJsonRecordMigration(result, 'tag_colors', LS_KEYS.tagColors, 'laputa:tag-color-overrides')
  applyJsonRecordMigration(result, 'status_colors', LS_KEYS.statusColors, 'laputa:status-color-overrides')
  applyJsonRecordMigration(result, 'property_display_modes', LS_KEYS.propertyModes, 'laputa:display-mode-overrides')
  markMigrationCompleted()

  return result
}

/**
 * One-time, per-vault migration for the inbox-automation default flip.
 *
 * Before the default flipped ON, `SettingsPanel.handleSave` wrote
 * `inbox_automation_enabled` on *every* save, seeded from `Boolean(null)`
 * === `false`. Any vault whose owner opened Settings once — for any
 * unrelated reason — therefore carries an explicit `false` that nobody
 * chose, and "default ON when unset" never reaches it.
 *
 * So treat a stored `false` as unset exactly once per vault. A `false`
 * written afterwards is a deliberate opt-out and is left alone.
 *
 * Per-vault, not global: the config is keyed by vault path, so a single
 * global flag would migrate whichever vault happened to open first and
 * silently skip every other one.
 *
 * The flag is set even when nothing changed. That is deliberate — once the
 * default is ON the Settings draft seeds `true`, so any later `false` can
 * only come from a real toggle, and an unmarked vault would clobber it.
 */
export function migrateInboxAutomationDefault(
  config: VaultConfig,
  vaultPath: string,
): VaultConfig {
  try {
    const key = `${APP_STORAGE_KEYS.inboxAutomationMigrationPrefix}${vaultPath}`
    if (localStorage.getItem(key) === '1') return config
    localStorage.setItem(key, '1')
    if (config.inbox_automation_enabled !== false) return config
    return { ...config, inbox_automation_enabled: null }
  } catch {
    // localStorage unavailable — never migrate without being able to
    // record that we did, or it would repeat on every load.
    return config
  }
}
