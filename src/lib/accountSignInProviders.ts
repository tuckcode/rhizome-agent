/**
 * Account providers that offer browser sign-in (ADR-0186).
 * ChatGPT ships first; xAI and possibly Claude can join this list later
 * without changing Connected or picker wiring.
 */

/** Built-in OpenAI row id. Must match Rust `BUILTIN_OPENAI_PROVIDER_ID`. */
export const CHATGPT_ACCOUNT_PROVIDER_ID = 'openai'

/** Official host for a ChatGPT sign-in token. Anything else hides sign-in UI. */
export const OPENAI_API_V1 = 'https://api.openai.com/v1'

export interface AccountSignInProvider {
  /** Host id passed to oauth_* commands. */
  id: string
  /** Row / group label, e.g. "ChatGPT". */
  label: string
  /** Sign-in button copy. */
  signInLabel: string
  /** Provider kind used for model targets when signed in. */
  providerKind: 'open_ai'
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
