import { describe, expect, it } from 'vitest'
import {
  CONNECTED_SUMMARY_ROW_ID,
  consumeProviderSettingsFocus,
  requestProviderSettingsFocus,
} from './providerSettingsFocus'

describe('provider settings focus', () => {
  it('remembers the tab and row until settings reads it', () => {
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
})
