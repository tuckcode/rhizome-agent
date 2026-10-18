import { describe, expect, it } from 'vitest'
import {
  SETTINGS_SECTION_IDS,
  resolveSettingsSectionId,
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

})
