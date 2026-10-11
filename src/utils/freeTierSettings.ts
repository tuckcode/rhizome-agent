import { callHost } from '../lib/callHost'

/** The user's free-tier choices (step 3b). Mirrors `rhizome_routing::free_tier::FreeTierSettings`. */
export interface FreeTierSettings {
  disabled: string[]
  optIn: string[]
  strict: boolean
  /** A saved provider id tried last, or null for none. */
  ownEndpoint: string | null
  /** The own endpoint's model, or null for its first model. */
  ownEndpointModel: string | null
}

/** A saved provider that can be the own endpoint. Mirrors `EndpointChoice`. */
export interface EndpointChoice {
  id: string
  name: string
  /** Model ids in saved order. The first is the default. */
  models: string[]
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
  /** The keychain could not be read, so key state is unknown. */
  keyError: string | null
  billingWarning: string | null
  hardStop: boolean
}

/** Mirrors `FreeTierOverview`. */
export interface FreeTierOverview {
  providers: FreeTierProviderRow[]
  strict: boolean
  routeOrder: string[]
  usable: boolean
  /** Null when nothing is chosen, or the chosen provider was deleted. */
  ownEndpoint: string | null
  ownEndpointModel: string | null
  endpointChoices: EndpointChoice[]
}

/** The router's id for the own endpoint in `routeOrder`. Mirrors `USER_ENDPOINT_ID`. */
export const OWN_ENDPOINT_ROUTE_ID = 'custom'

export function getFreeTierOverview(): Promise<FreeTierOverview> {
  return callHost<FreeTierOverview>('get_free_tier_overview')
}

export function saveFreeTierSettings(settings: FreeTierSettings): Promise<FreeTierOverview> {
  return callHost<FreeTierOverview>('save_free_tier_settings', { settings })
}

/** Saves a key or account id in the OS keychain (`save_ai_model_provider_api_key`). */
export function saveFreeTierSecret(account: string, value: string): Promise<void> {
  return callHost<void>('save_ai_model_provider_api_key', { providerId: account, apiKey: value })
}

/** Removes a key or account id. Removing a provider key also removes its account id. */
export function deleteFreeTierSecret(account: string): Promise<void> {
  return callHost<void>('delete_ai_model_provider_api_key', { providerId: account })
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
    ownEndpoint: overview.ownEndpoint,
    ownEndpointModel: overview.ownEndpointModel,
  }
}
