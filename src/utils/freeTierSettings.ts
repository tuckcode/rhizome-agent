import { callHost } from '../lib/callHost'

/** The user's free-tier choices (step 3b). Mirrors `rhizome_routing::free_tier::FreeTierSettings`. */
export interface FreeTierSettings {
  disabled: string[]
  optIn: string[]
  strict: boolean
}

/** One provider row. Mirrors `FreeTierProviderRow`. Never holds a key. */
export interface FreeTierProviderRow {
  id: string
  name: string
  defaultOn: boolean
  enabled: boolean
  hasKey: boolean
  needsAccountId: boolean
  hasAccountId: boolean
  billingWarning: string | null
  hardStop: boolean
}

/** Mirrors `FreeTierOverview`. */
export interface FreeTierOverview {
  providers: FreeTierProviderRow[]
  strict: boolean
  routeOrder: string[]
  usable: boolean
}

export function getFreeTierOverview(): Promise<FreeTierOverview> {
  return callHost<FreeTierOverview>('get_free_tier_overview')
}

export function saveFreeTierSettings(settings: FreeTierSettings): Promise<FreeTierOverview> {
  return callHost<FreeTierOverview>('save_free_tier_settings', { settings })
}

/** The keychain account that holds a provider's account id (Cloudflare). */
export function accountIdKeyFor(providerId: string): string {
  return `${providerId}:account`
}

/** The settings an overview implies, so one switch can change without losing the rest. */
export function settingsFromOverview(overview: FreeTierOverview): FreeTierSettings {
  return {
    disabled: overview.providers.filter((row) => row.defaultOn && !row.enabled).map((row) => row.id),
    optIn: overview.providers.filter((row) => !row.defaultOn && row.enabled).map((row) => row.id),
    strict: overview.strict,
  }
}
