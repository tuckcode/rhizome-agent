export const SETTINGS_SECTION_IDS = {
  sync: 'settings-section-sync',
  workspaces: 'settings-section-workspaces',
  autogit: 'settings-section-autogit',
  appearance: 'settings-section-appearance',
  content: 'settings-section-content',
  ai: 'settings-section-ai',
  workflow: 'settings-section-workflow',
  /** @deprecated Packages was a top-level Settings page. Same target as primeEngine. */
  extensions: 'settings-section-extensions',
  primeEngine: 'settings-section-prime-engine',
  privacy: 'settings-section-privacy',
  about: 'settings-section-about',
} as const

const LEGACY_PACKAGES_SECTION_IDS = new Set([
  SETTINGS_SECTION_IDS.extensions,
  'packages',
  'settings-section-packages',
])

export function isLegacyPackagesSettingsSection(id: string | null | undefined): boolean {
  return typeof id === 'string' && LEGACY_PACKAGES_SECTION_IDS.has(id)
}

export function resolveSettingsSectionId(id: string | null | undefined): string | null {
  if (!id) return null
  if (isLegacyPackagesSettingsSection(id) || id === SETTINGS_SECTION_IDS.primeEngine) {
    return SETTINGS_SECTION_IDS.ai
  }
  return id
}

export function shouldOpenAdvancedPrimeEngine(_id: string | null | undefined): boolean {
  return false
}
