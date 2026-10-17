import { describe, expect, it } from 'vitest'
import {
  SETTINGS_SECTION_IDS,
  resolveSettingsSectionId,
  shouldOpenAdvancedPrimeEngine,
} from './settingsSectionIds'

describe('legacy Packages Settings deep links', () => {
  it('sends the old Packages and Advanced Prime section ids to Agents', () => {
    expect(resolveSettingsSectionId(SETTINGS_SECTION_IDS.extensions)).toBe(
      SETTINGS_SECTION_IDS.ai,
    )
    expect(resolveSettingsSectionId('packages')).toBe(SETTINGS_SECTION_IDS.ai)
    expect(resolveSettingsSectionId('settings-section-packages')).toBe(
      SETTINGS_SECTION_IDS.ai,
    )
    expect(resolveSettingsSectionId(SETTINGS_SECTION_IDS.primeEngine)).toBe(
      SETTINGS_SECTION_IDS.ai,
    )
  })

  it('leaves other Settings section ids unchanged', () => {
    expect(resolveSettingsSectionId(SETTINGS_SECTION_IDS.ai)).toBe(SETTINGS_SECTION_IDS.ai)
    expect(resolveSettingsSectionId(null)).toBeNull()
  })

  it('never opens Advanced Prime engine; that Settings page is gone', () => {
    expect(shouldOpenAdvancedPrimeEngine('packages')).toBe(false)
    expect(shouldOpenAdvancedPrimeEngine(SETTINGS_SECTION_IDS.extensions)).toBe(false)
    expect(shouldOpenAdvancedPrimeEngine(SETTINGS_SECTION_IDS.primeEngine)).toBe(false)
    expect(shouldOpenAdvancedPrimeEngine(SETTINGS_SECTION_IDS.ai)).toBe(false)
  })
})
