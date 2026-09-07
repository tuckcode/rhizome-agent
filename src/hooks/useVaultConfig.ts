import { useEffect, useCallback, useSyncExternalStore } from 'react'
import type { VaultConfig } from '../types'
import { initStatusColors } from '../utils/statusStyles'
import { initTagColors } from '../utils/tagStyles'
import { initDisplayModeOverrides } from '../utils/propertyTypes'
import {
  getVaultConfig,
  bindVaultConfigStore,
  resetVaultConfigStore,
  updateVaultConfigField,
  subscribeVaultConfig,
} from '../utils/vaultConfigStore'
import { migrateLocalStorageToVaultConfig, migrateInboxAutomationDefault } from '../utils/configMigration'
import { DEFAULT_AI_AGENT_PERMISSION_MODE } from '../lib/aiAgentPermissionMode'
import { trackEvent } from '../lib/telemetry'

const STORAGE_PREFIX = 'rhizome:vault-config:'
/**
 * This key was never migrated even once — it stayed on "laputa" through
 * the laputa->tolaria rename and would have carried straight through this
 * tolaria->rhizome one too, had it not been caught auditing localStorage
 * usage for ADR-0162. Kept as a permanent read fallback (not a one-time
 * copy) since a per-vault config is cheap to re-check on every load, and a
 * config edit always writes through `storageKey`, so a vault naturally
 * moves onto the current key the first time anything in it changes.
 */
const LEGACY_STORAGE_PREFIX = 'laputa:vault-config:'

function storageKey(vaultPath: string): string {
  return `${STORAGE_PREFIX}${vaultPath}`
}

function legacyStorageKey(vaultPath: string): string {
  return `${LEGACY_STORAGE_PREFIX}${vaultPath}`
}

/** Exported for `loadFromStorage.test.ts` — this hook otherwise has no
 * direct unit tests, so the legacy-key fallback needs its own test surface. */
export function loadFromStorage(vaultPath: string): VaultConfig {
  const DEFAULT: VaultConfig = {
    zoom: null, view_mode: null, editor_mode: null,
    git_setup_preference: 'prompt',
    ai_agent_permission_mode: DEFAULT_AI_AGENT_PERMISSION_MODE,
    tag_colors: null, status_colors: null, property_display_modes: null,
    inbox: null, allNotes: null, inbox_automation_enabled: null, session_auto_distill_enabled: null,
  }
  try {
    const raw = localStorage.getItem(storageKey(vaultPath)) ?? localStorage.getItem(legacyStorageKey(vaultPath))
    if (!raw) return DEFAULT
    return { ...DEFAULT, ...JSON.parse(raw) }
  } catch {
    return DEFAULT
  }
}

function saveToStorage(vaultPath: string, config: VaultConfig): void {
  try {
    localStorage.setItem(storageKey(vaultPath), JSON.stringify(config))
  } catch (err) {
    console.warn('Failed to save vault config:', err)
  }
}

function applyToModules(c: VaultConfig): void {
  initStatusColors(c.status_colors ?? {})
  initTagColors(c.tag_colors ?? {})
  initDisplayModeOverrides(c.property_display_modes ?? {})
}

export function useVaultConfig(vaultPath: string) {
  const config = useSyncExternalStore(subscribeVaultConfig, getVaultConfig, getVaultConfig)

  useEffect(() => {
    resetVaultConfigStore()

    const loaded = loadFromStorage(vaultPath)
    const migrated = migrateInboxAutomationDefault(
      migrateLocalStorageToVaultConfig(loaded),
      vaultPath,
    )
    const needsSave = migrated !== loaded
    // Only when this vault actually carried the stale `false`. No vault path
    // or note data — just the fact that one more vault got unblocked.
    if (loaded.inbox_automation_enabled === false && migrated.inbox_automation_enabled === null) {
      trackEvent('vault_inbox_automation_default_migrated')
    }
    bindVaultConfigStore(migrated, (c) => saveToStorage(vaultPath, c))
    applyToModules(migrated)
    if (needsSave) saveToStorage(vaultPath, migrated)

    return () => resetVaultConfigStore()
  }, [vaultPath])

  const update = useCallback(<K extends keyof VaultConfig>(key: K, value: VaultConfig[K]) => {
    updateVaultConfigField(key, value)
    // Re-apply to modules for color/property changes
    const next = getVaultConfig()
    applyToModules(next)
  }, [])

  return { config, updateConfig: update }
}
