import { describe, expect, it } from 'vitest'
import {
  CONNECTED_SUMMARY_ROW_ID,
  clearSettingsOpenAutofocusSuppress,
  consumeProviderSettingsFocus,
  isSettingsOpenAutofocusSuppressed,
  requestProviderSettingsFocus,
} from './providerSettingsFocus'

describe('provider settings focus', () => {
  it('remembers the tab and row until settings reads it', () => {
    clearSettingsOpenAutofocusSuppress()
    requestProviderSettingsFocus({ tab: 'api', rowId: 'provider-kind-open_ai' })
    expect(consumeProviderSettingsFocus()).toEqual({
      tab: 'api',
      rowId: 'provider-kind-open_ai',
    })
    expect(consumeProviderSettingsFocus()).toBeNull()
  })

  it('names the connected summary row', () => {
    expect(CONNECTED_SUMMARY_ROW_ID).toBe('connected-providers')
  })

  it('suppresses Settings open autofocus until cleared after Add key', () => {
    clearSettingsOpenAutofocusSuppress()
    expect(isSettingsOpenAutofocusSuppressed()).toBe(false)
    requestProviderSettingsFocus({ tab: 'api', rowId: 'summary-provider-row-open_ai' })
    expect(isSettingsOpenAutofocusSuppressed()).toBe(true)
    // Consuming the row target must not re-arm Sync autofocus mid-open.
    expect(consumeProviderSettingsFocus()?.rowId).toBe('summary-provider-row-open_ai')
    expect(isSettingsOpenAutofocusSuppressed()).toBe(true)
    clearSettingsOpenAutofocusSuppress()
    expect(isSettingsOpenAutofocusSuppressed()).toBe(false)
  })
})
