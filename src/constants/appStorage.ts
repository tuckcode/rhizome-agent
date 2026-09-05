export const APP_STORAGE_KEYS = {
  theme: 'rhizome-theme',
  zoom: 'rhizome:zoom-level',
  viewMode: 'rhizome-view-mode',
  tagColors: 'rhizome:tag-color-overrides',
  statusColors: 'rhizome:status-color-overrides',
  propertyModes: 'rhizome:display-mode-overrides',
  configMigrationFlag: 'rhizome:config-migrated-to-vault',
  legacyMigrationFlag: 'rhizome:legacy-storage-migrated',
  /** Per-vault; the vault path is appended. See migrateInboxAutomationDefault. */
  inboxAutomationMigrationPrefix: 'rhizome:inbox-automation-migrated:',
  sortPreferences: 'rhizome-sort-preferences',
  sidebarCollapsed: 'rhizome:sidebar-collapsed',
  layoutPanels: 'rhizome:layout-panels',
  // Chat home's sessions column. New in this generation, so it has no
  // `tolaria` twin and is deliberately absent from LEGACY_APP_STORAGE_KEYS.
  chatSessionsOpen: 'rhizome:chat-sessions-open',
  chatNotePaneWidth: 'rhizome:chat-note-pane-width',
  connectionsPanelWidth: 'rhizome:connections-panel-width',
  chatSessionsWidth: 'rhizome:chat-sessions-width',
  myceliumSessionsWidth: 'rhizome:mycelium-sessions-width',
  commandRailExpanded: 'rhizome:command-rail-expanded',
  commandRailWidth: 'rhizome:command-rail-width',
  welcomeDismissed: 'rhizome_welcome_dismissed',
} as const

/**
 * Prior generation ("tolaria", the pre-rename product name). Not "laputa"
 * (two generations back) — this file's own `legacyMigrationFlag` is
 * already set on any machine that ever ran a laputa-era build, since that
 * migration already copied laputa values forward into these tolaria keys.
 * So falling back one generation here already recovers the laputa case for
 * free; a second fallback tier would be dead weight. See ADR-0162.
 */
export const LEGACY_APP_STORAGE_KEYS = {
  theme: 'tolaria-theme',
  zoom: 'tolaria:zoom-level',
  viewMode: 'tolaria-view-mode',
  tagColors: 'tolaria:tag-color-overrides',
  statusColors: 'tolaria:status-color-overrides',
  propertyModes: 'tolaria:display-mode-overrides',
  configMigrationFlag: 'tolaria:config-migrated-to-vault',
  sortPreferences: 'tolaria-sort-preferences',
  sidebarCollapsed: 'tolaria:sidebar-collapsed',
  layoutPanels: 'tolaria:layout-panels',
  welcomeDismissed: 'tolaria_welcome_dismissed',
} as const

type MigratableStorageKey = keyof typeof LEGACY_APP_STORAGE_KEYS

const MIGRATABLE_STORAGE_KEYS: MigratableStorageKey[] = [
  'theme',
  'zoom',
  'viewMode',
  'tagColors',
  'statusColors',
  'propertyModes',
  'configMigrationFlag',
  'sortPreferences',
  'sidebarCollapsed',
  'layoutPanels',
  'welcomeDismissed',
]

export function copyLegacyAppStorageKeys(): void {
  try {
    if (localStorage.getItem(APP_STORAGE_KEYS.legacyMigrationFlag) === '1') return

    for (const key of MIGRATABLE_STORAGE_KEYS) {
      const storageKey = Reflect.get(APP_STORAGE_KEYS, key) as string
      const legacyStorageKey = Reflect.get(LEGACY_APP_STORAGE_KEYS, key) as string
      if (localStorage.getItem(storageKey) !== null) continue

      const legacyValue = localStorage.getItem(legacyStorageKey)
      if (legacyValue !== null) {
        localStorage.setItem(storageKey, legacyValue)
      }
    }

    localStorage.setItem(APP_STORAGE_KEYS.legacyMigrationFlag, '1')
  } catch {
    // Ignore unavailable or restricted localStorage implementations.
  }
}

export function getAppStorageItem(key: MigratableStorageKey): string | null {
  try {
    const storageKey = Reflect.get(APP_STORAGE_KEYS, key) as string
    const legacyStorageKey = Reflect.get(LEGACY_APP_STORAGE_KEYS, key) as string
    return localStorage.getItem(storageKey) ?? localStorage.getItem(legacyStorageKey)
  } catch {
    return null
  }
}
