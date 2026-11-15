/**
 * Account providers that offer browser sign-in (ADR-0186).
 * ChatGPT ships first. xAI is a preview on a shared public client id.
 * Claude stays API key only.
 */

import { DEFAULT_MODEL_CAPABILITIES, type AiModelProvider } from './aiTargets'
import { providerPresetById } from './providerPresets'

/** Built-in OpenAI row id. Must match Rust `BUILTIN_OPENAI_PROVIDER_ID`. */
export const CHATGPT_ACCOUNT_PROVIDER_ID = 'openai'

/** Official host for a ChatGPT sign-in token. Anything else hides sign-in UI. */
export const OPENAI_API_V1 = 'https://api.openai.com/v1'

/** Built-in xAI row id. Must match Rust `BUILTIN_XAI_PROVIDER_ID`. */
export const XAI_ACCOUNT_PROVIDER_ID = 'xai'

/** Official host for an xAI sign-in token. Anything else hides sign-in UI. */
export const XAI_API_V1 = 'https://api.x.ai/v1'

export interface AccountSignInProvider {
  /** Host id passed to oauth_* commands. */
  id: string
  /** Row / group label, e.g. "ChatGPT". */
  label: string
  /** Sign-in button copy. */
  signInLabel: string
  /** Provider kind used for model targets when signed in. */
  providerKind: 'open_ai' | 'open_ai_compatible'
  /** Base URL that must match for sign-in to apply. */
  requiredBaseUrl: string
}

export const ACCOUNT_SIGN_IN_PROVIDERS: readonly AccountSignInProvider[] = [
  {
    id: CHATGPT_ACCOUNT_PROVIDER_ID,
    label: 'ChatGPT',
    signInLabel: 'Sign in with ChatGPT',
    providerKind: 'open_ai',
    requiredBaseUrl: OPENAI_API_V1,
  },
  {
    id: XAI_ACCOUNT_PROVIDER_ID,
    label: 'xAI (preview)',
    signInLabel: 'Sign in with xAI',
    providerKind: 'open_ai_compatible',
    requiredBaseUrl: XAI_API_V1,
  },
]

export function accountSignInProvider(id: string): AccountSignInProvider | undefined {
  const needle = id.trim().toLowerCase()
  return ACCOUNT_SIGN_IN_PROVIDERS.find((entry) => entry.id === needle)
}

/** True when this provider row may show ChatGPT sign-in (exact host). */
export function providerAllowsChatgptSignIn(input: {
  id?: string | null
  kind?: string | null
  baseUrl?: string | null
}): boolean {
  const kind = (input.kind ?? '').trim().toLowerCase()
  if (kind !== 'open_ai') return false
  const base = (input.baseUrl ?? OPENAI_API_V1).trim().replace(/\/+$/, '')
  const expected = OPENAI_API_V1.replace(/\/+$/, '')
  if (base !== expected) return false
  const id = (input.id ?? '').trim().toLowerCase()
  // Builtin catalog/preset ids, or an explicit openai id.
  return id === '' || id === 'openai' || id === 'open_ai'
}

export function normalizeProviderBaseUrl(baseUrl: string | null | undefined): string {
  const raw = (baseUrl ?? '').trim()
  if (!raw) return OPENAI_API_V1
  return raw.replace(/\/+$/, '')
}

/** oauth.signIn / normalize_openai only accept `openai`, never `open_ai`. */
export function normalizeOauthSignInProvider(provider: string): string {
  const id = provider.trim().toLowerCase()
  if (id === '' || id === 'openai' || id === 'open_ai') return CHATGPT_ACCOUNT_PROVIDER_ID
  return id
}

/**
 * The Settings row an xAI sign-in chats through. It matches the xAI preset,
 * so an API key saved on it takes over after sign-out.
 */
export function xaiAccountProviderRow(): AiModelProvider {
  return {
    id: XAI_ACCOUNT_PROVIDER_ID,
    name: 'xAI',
    kind: 'open_ai_compatible',
    base_url: XAI_API_V1,
    api_key_storage: 'local_file',
    api_key_env_var: null,
    headers: null,
    models: [{
      id: providerPresetById(XAI_ACCOUNT_PROVIDER_ID)?.modelId ?? 'grok-4.3',
      display_name: null,
      context_window: null,
      max_output_tokens: null,
      capabilities: DEFAULT_MODEL_CAPABILITIES,
    }],
  }
}

/** False when the built-in xAI row was edited to another host. */
export function xaiOfficialHostConfigured(
  providers?: Array<{ id?: string | null; base_url?: string | null }> | null,
): boolean {
  return (providers ?? [])
    .filter((provider) => provider.id?.trim().toLowerCase() === XAI_ACCOUNT_PROVIDER_ID)
    .every((provider) => normalizeProviderBaseUrl(provider.base_url) === XAI_API_V1)
}

/** One check for Connected and the picker, whichever account the row shows. */
export function accountHostConfigured(
  accountId: string,
  providers?: Array<{ id?: string | null; kind?: string | null; base_url?: string | null }> | null,
): boolean {
  return accountId === XAI_ACCOUNT_PROVIDER_ID
    ? xaiOfficialHostConfigured(providers)
    : chatgptOfficialHostConfigured(providers)
}

/**
 * ChatGPT account chrome stays Ready only while the built-in OpenAI row
 * still points at the official host (or no OpenAI row is configured yet).
 */
export function chatgptOfficialHostConfigured(
  providers?: Array<{ id?: string | null; kind?: string | null; base_url?: string | null }> | null,
): boolean {
  const rows = (providers ?? []).filter((provider) => {
    const kind = (provider.kind ?? '').trim().toLowerCase()
    if (kind !== 'open_ai') return false
    const id = (provider.id ?? '').trim().toLowerCase()
    return id === '' || id === 'openai' || id === 'open_ai'
  })
  if (rows.length === 0) return true
  return rows.every((provider) =>
    providerAllowsChatgptSignIn({
      id: provider.id,
      kind: provider.kind,
      baseUrl: provider.base_url,
    }),
  )
}

