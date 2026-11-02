import { callHost } from './callHost'
import { CHATGPT_ACCOUNT_PROVIDER_ID } from './accountSignInProviders'

/** Mirrors Rust `OauthStatus`. No token fields. */
export interface OauthStatus {
  provider: string
  enabled: boolean
  signed_in: boolean
  usable: boolean
  email: string | null
  revoked: boolean
}

export const SIGNED_OUT_OAUTH: OauthStatus = {
  provider: CHATGPT_ACCOUNT_PROVIDER_ID,
  enabled: false,
  signed_in: false,
  usable: false,
  email: null,
  revoked: true,
}

export async function fetchOauthStatus(provider = CHATGPT_ACCOUNT_PROVIDER_ID): Promise<OauthStatus> {
  return callHost<OauthStatus>('oauth_status', { provider })
}

export async function startOauthSignIn(provider = CHATGPT_ACCOUNT_PROVIDER_ID): Promise<OauthStatus> {
  return callHost<OauthStatus>('oauth_sign_in', { provider })
}

export async function signOutOauth(provider = CHATGPT_ACCOUNT_PROVIDER_ID): Promise<OauthStatus> {
  return callHost<OauthStatus>('oauth_sign_out', { provider })
}

export async function cancelOauthSignIn(): Promise<void> {
  await callHost('oauth_cancel')
}

export function oauthAccountReady(status: OauthStatus | null | undefined): boolean {
  return Boolean(status?.signed_in && status.usable && status.enabled)
}
