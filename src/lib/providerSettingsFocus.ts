export type ProviderSettingsTab = 'agents' | 'local' | 'api'

export interface ProviderSettingsFocus {
  tab: ProviderSettingsTab
  rowId: string
}

export const PROVIDER_SETTINGS_FOCUS_EVENT = 'rhizome-provider-settings-focus'
export const CONNECTED_SUMMARY_ROW_ID = 'connected-providers'

let pending: ProviderSettingsFocus | null = null

export function requestProviderSettingsFocus(focus: ProviderSettingsFocus): void {
  pending = focus
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(PROVIDER_SETTINGS_FOCUS_EVENT, { detail: focus }))
}

export function consumeProviderSettingsFocus(): ProviderSettingsFocus | null {
  const value = pending
  pending = null
  return value
}

export function subscribeProviderSettingsFocus(
  listener: (focus: ProviderSettingsFocus) => void,
): () => void {
  if (typeof window === 'undefined') return () => {}
  const onEvent = (event: Event) => {
    const detail = (event as CustomEvent<ProviderSettingsFocus>).detail
    if (!detail?.tab || !detail.rowId) return
    listener(detail)
  }
  window.addEventListener(PROVIDER_SETTINGS_FOCUS_EVENT, onEvent)
  return () => window.removeEventListener(PROVIDER_SETTINGS_FOCUS_EVENT, onEvent)
}
