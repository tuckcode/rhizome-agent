import { describe, expect, it } from 'vitest'
import {
  SETTINGS_SECTION_IDS,
  resolveSettingsSectionId,
  shouldOpenAdvancedPrimeEngine,
} from './settingsSectionIds'

describe('legacy Packages Settings deep links', () => {
  it('sends the old Packages section ids to Advanced Prime engine', () => {
    expect(resolveSettingsSectionId(SETTINGS_SECTION_IDS.extensions)).toBe(
      SETTINGS_SECTION_IDS.primeEngine,
    )
    expect(resolveSettingsSectionId('packages')).toBe(SETTINGS_SECTION_IDS.primeEngine)
    expect(resolveSettingsSectionId('settings-section-packages')).toBe(
      SETTINGS_SECTION_IDS.primeEngine,
    )
  })

  it('leaves other Settings section ids unchanged', () => {
    expect(resolveSettingsSectionId(SETTINGS_SECTION_IDS.ai)).toBe(SETTINGS_SECTION_IDS.ai)
    expect(resolveSettingsSectionId(null)).toBeNull()
  })

  it('opens Advanced Prime engine for Packages aliases and the Prime section itself', () => {
    expect(shouldOpenAdvancedPrimeEngine('packages')).toBe(true)
    expect(shouldOpenAdvancedPrimeEngine(SETTINGS_SECTION_IDS.extensions)).toBe(true)
    expect(shouldOpenAdvancedPrimeEngine(SETTINGS_SECTION_IDS.primeEngine)).toBe(true)
    expect(shouldOpenAdvancedPrimeEngine(SETTINGS_SECTION_IDS.ai)).toBe(false)
  })
})
