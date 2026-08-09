const DEFAULT_POSTHOG_HOST = 'https://us.i.posthog.com'
const IPV6_ADDRESS_CHARS = new Set('0123456789abcdefABCDEF:')
const DISALLOWED_TELEMETRY_VALUES = new Set([
  'false',
  'true',
  'null',
  'undefined',
  'none',
  'disabled',
])

type TelemetryEnv = {
  VITE_SENTRY_DSN?: string
  VITE_SENTRY_RELEASE?: string
  VITE_POSTHOG_KEY?: string
  VITE_POSTHOG_HOST?: string
}

interface HostnameInput {
  hostname: string
}

interface HostSegmentInput {
  segment: string
}

interface TelemetryValueInput {
  value: string
}

export type FrontendTelemetryConfig = {
  sentryDsn: string
  sentryBuildVersion: string
  sentryRelease: string
  posthogKey: string
  posthogHost: string | null
}

function unwrapMatchingQuotes({ value }: TelemetryValueInput): string {
  if (value.length < 2) return value

  const first = value[0]
  const last = value[value.length - 1]
  if (first !== last) return value
  if (first !== '"' && first !== "'") return value

  return value.slice(1, -1).trim()
}

export function sanitizeTelemetryEnvValue(value: string | undefined): string {
  if (!value) return ''

  const trimmed = value.trim()
  if (!trimmed) return ''

  return unwrapMatchingQuotes({ value: trimmed })
}

function isHttpUrl({ value }: TelemetryValueInput): boolean {
  try {
    const url = new URL(value)
    return (url.protocol === 'http:' || url.protocol === 'https:')
      && isAllowedTelemetryHostname({ hostname: url.hostname })
  } catch {
    return false
  }
}

function normalizeHostname({ hostname }: HostnameInput): string {
  const normalized = hostname.trim().replace(/\.$/, '').toLowerCase()
  if (normalized.startsWith('[') && normalized.endsWith(']')) {
    return normalized.slice(1, -1)
  }
  return normalized
}

function isIpAddress({ hostname }: HostnameInput): boolean {
  return isIpv4Address({ hostname }) || isIpv6LikeAddress({ hostname })
}

function isIpv4Address({ hostname }: HostnameInput): boolean {
  const segments = hostname.split('.')
  return segments.length === 4 && segments.every((segment) => isIpv4Segment({ segment }))
}

function isIpv4Segment({ segment }: HostSegmentInput): boolean {
  const value = Number(segment)
  return segment.length > 0
    && Array.from(segment).every((char) => char >= '0' && char <= '9')
    && Number.isInteger(value)
    && value >= 0
    && value <= 255
}

function isIpv6LikeAddress({ hostname }: HostnameInput): boolean {
  return hostname.includes(':') && Array.from(hostname).every((char) => IPV6_ADDRESS_CHARS.has(char))
}

function isAllowedTelemetryHostname({ hostname }: HostnameInput): boolean {
  const normalized = normalizeHostname({ hostname })
  if (!normalized || DISALLOWED_TELEMETRY_VALUES.has(normalized)) return false
  if (normalized === 'localhost') return true
  return normalized.includes('.') || isIpAddress({ hostname: normalized })
}

function normalizeHttpLikeValue({ value }: TelemetryValueInput): string {
  if (!value) return ''
  if (/^[a-z][a-z\d+\-.]*:\/\//i.test(value)) return value
  return `https://${value}`
}

function normalizeSentryDsn({ value }: TelemetryValueInput): string {
  const normalized = normalizeHttpLikeValue({ value })
  return isHttpUrl({ value: normalized }) ? normalized : ''
}

function normalizeSentryRelease({ value }: TelemetryValueInput): string {
  const match = /^(\d{4})\.(\d{1,2})\.(\d{1,2})$/.exec(value)
  if (!match) return ''

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  const validDate = date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day

  return validDate ? value : ''
}

function normalizePostHogHost({ value }: TelemetryValueInput): string | null {
  if (!value) return DEFAULT_POSTHOG_HOST
  const normalized = normalizeHttpLikeValue({ value })
  return isHttpUrl({ value: normalized }) ? normalized : null
}

export function resolveFrontendTelemetryConfig(
  env: TelemetryEnv = import.meta.env as TelemetryEnv,
): FrontendTelemetryConfig {
  const sentryDsn = normalizeSentryDsn({
    value: sanitizeTelemetryEnvValue(env.VITE_SENTRY_DSN),
  })
  const sanitizedSentryVersion = sanitizeTelemetryEnvValue(env.VITE_SENTRY_RELEASE)
  const sentryBuildVersion = DISALLOWED_TELEMETRY_VALUES.has(sanitizedSentryVersion.toLowerCase())
    ? ''
    : sanitizedSentryVersion
  const sentryRelease = normalizeSentryRelease({ value: sentryBuildVersion })
  const posthogKey = sanitizeTelemetryEnvValue(env.VITE_POSTHOG_KEY)
  const posthogHost = normalizePostHogHost({
    value: sanitizeTelemetryEnvValue(env.VITE_POSTHOG_HOST),
  })

  return { sentryDsn, sentryBuildVersion, sentryRelease, posthogKey, posthogHost }
}

export { DEFAULT_POSTHOG_HOST as _defaultPostHogHostForTest }
