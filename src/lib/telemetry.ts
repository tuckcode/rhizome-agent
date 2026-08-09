import * as Sentry from '@sentry/react'
import { resolveFrontendTelemetryConfig } from './telemetryConfig'
import { sanitizeDiagnosticText } from './sensitiveTextRedaction'
import {
  hasActiveWhiteboardPlatformPermissionGuard,
  isWhiteboardPlatformPermissionRejection,
} from '../utils/whiteboardPlatformPermissionRejection'
import { classifyRichEditorRecoveryError } from '../components/richEditorRecoveryClassifier'

type SensitiveTelemetryText = string
type AnonymousTelemetryId = string
type ReleaseChannel = string
type FeatureFlagKey = string
type ProductAnalyticsEventName = string
type ProductAnalyticsProperties = Record<string, string | number>

const STALE_TAURI_LISTENER_CLEANUP_SIGNATURE = "listeners[eventId].handlerId"
const BLOCKNOTE_STALE_BLOCK_REFERENCE_PATTERN = /(^|: )Block with ID .+ not found$/
const RESIZE_OBSERVER_LOOP_MESSAGES = [
  'ResizeObserver loop completed with undelivered notifications',
  'ResizeObserver loop limit exceeded',
] as const

function scrubPaths(input: SensitiveTelemetryText): string {
  return sanitizeDiagnosticText({ text: input })
}

function isStaleTauriListenerCleanupText(value: string | undefined): boolean {
  return value?.includes(STALE_TAURI_LISTENER_CLEANUP_SIGNATURE) ?? false
}

function isBlockNoteStaleBlockReferenceText(value: string | undefined): boolean {
  return value ? BLOCKNOTE_STALE_BLOCK_REFERENCE_PATTERN.test(value) : false
}

function isResizeObserverLoopText(value: string | undefined): boolean {
  return value
    ? RESIZE_OBSERVER_LOOP_MESSAGES.some((message) => value.includes(message))
    : false
}

function recoveredRichEditorDomNotFoundError(name: string | undefined, message: string | undefined): boolean {
  if (!name || !message) return false

  return classifyRichEditorRecoveryError({ name, message }, 'render') === 'dom_not_found'
}

function recoveredRichEditorDomNotFoundText(value: string | undefined): boolean {
  const [name, ...messageParts] = value?.split(':') ?? []
  const message = messageParts.join(':').trim()

  return recoveredRichEditorDomNotFoundError(name, message)
}

function errorText(value: unknown): string | undefined {
  if (!value) return undefined
  if (value instanceof Error) return `${value.name}: ${value.message}`
  if (typeof value === 'string') return value
  if (typeof value !== 'object') return undefined

  const maybeError = value as { message?: unknown; name?: unknown }
  const message = typeof maybeError.message === 'string' ? maybeError.message : undefined
  const name = typeof maybeError.name === 'string' ? maybeError.name : undefined
  return [name, message].filter(Boolean).join(': ') || undefined
}

function shouldDropWhiteboardPlatformPermissionEvent(
  event: Sentry.ErrorEvent,
  hint?: Sentry.EventHint,
): boolean {
  if (!hasActiveWhiteboardPlatformPermissionGuard()) return false
  if (isWhiteboardPlatformPermissionRejection(hint?.originalException)) return true

  return (event.exception?.values ?? []).some((exception) =>
    isWhiteboardPlatformPermissionRejection({
      message: exception.value ?? '',
      name: exception.type ?? '',
    }))
}

function shouldDropStaleTauriListenerCleanupEvent(
  event: Sentry.ErrorEvent,
  hint?: Sentry.EventHint,
): boolean {
  if (isStaleTauriListenerCleanupText(errorText(hint?.originalException))) return true
  if (isStaleTauriListenerCleanupText(event.message)) return true

  return (event.exception?.values ?? []).some((exception) =>
    isStaleTauriListenerCleanupText(exception.value))
}

function shouldDropBlockNoteStaleBlockReferenceEvent(
  event: Sentry.ErrorEvent,
  hint?: Sentry.EventHint,
): boolean {
  if (isBlockNoteStaleBlockReferenceText(errorText(hint?.originalException))) return true
  if (isBlockNoteStaleBlockReferenceText(event.message)) return true

  return (event.exception?.values ?? []).some((exception) =>
    isBlockNoteStaleBlockReferenceText(exception.value))
}

function shouldDropRichEditorDomNotFoundEvent(
  event: Sentry.ErrorEvent,
  hint?: Sentry.EventHint,
): boolean {
  if (classifyRichEditorRecoveryError(hint?.originalException, 'render') === 'dom_not_found') return true
  if (recoveredRichEditorDomNotFoundText(event.message)) return true

  return (event.exception?.values ?? []).some((exception) =>
    recoveredRichEditorDomNotFoundError(exception.type, exception.value))
}

function shouldDropResizeObserverLoopEvent(
  event: Sentry.ErrorEvent,
  hint?: Sentry.EventHint,
): boolean {
  if (isResizeObserverLoopText(errorText(hint?.originalException))) return true
  if (isResizeObserverLoopText(event.message)) return true

  return (event.exception?.values ?? []).some((exception) =>
    isResizeObserverLoopText(exception.value))
}

function shouldDropSentryEvent(event: Sentry.ErrorEvent, hint?: Sentry.EventHint): boolean {
  return shouldDropWhiteboardPlatformPermissionEvent(event, hint)
    || shouldDropStaleTauriListenerCleanupEvent(event, hint)
    || shouldDropBlockNoteStaleBlockReferenceEvent(event, hint)
    || shouldDropRichEditorDomNotFoundEvent(event, hint)
    || shouldDropResizeObserverLoopEvent(event, hint)
}

function scrubEventMessage(event: Sentry.ErrorEvent): void {
  if (event.message) event.message = scrubPaths(event.message)
}

function scrubExceptionValues(event: Sentry.ErrorEvent): void {
  for (const ex of event.exception?.values ?? []) {
    if (ex.value) ex.value = scrubPaths(ex.value)
  }
}

function scrubBreadcrumbMessages(event: Sentry.ErrorEvent): void {
  for (const breadcrumb of event.breadcrumbs ?? []) {
    if (breadcrumb.message) breadcrumb.message = scrubPaths(breadcrumb.message)
    if (breadcrumb.data) breadcrumb.data = scrubRecord(breadcrumb.data)
  }
}

function scrubRecord<T>(record: T): T {
  const scrubbed: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(record as Record<string, unknown>)) {
    if (typeof value === 'string') scrubbed[key] = scrubPaths(value)
    else if (typeof value === 'object' && value !== null) {
      scrubbed[key] = scrubRecord(value)
    } else {
      scrubbed[key] = value
    }
  }
  return scrubbed as T
}

function scrubSentryEvent(event: Sentry.ErrorEvent, hint?: Sentry.EventHint): Sentry.ErrorEvent | null {
  if (shouldDropSentryEvent(event, hint)) return null

  scrubEventMessage(event)
  scrubExceptionValues(event)
  scrubBreadcrumbMessages(event)

  if (event.extra) event.extra = scrubRecord(event.extra)
  if (event.tags) event.tags = scrubRecord(event.tags)
  if (event.contexts) event.contexts = scrubRecord(event.contexts)
  if (event.request) event.request = scrubRecord(event.request)
  if (event.exception?.values) {
    for (const ex of event.exception.values) {
      if (ex.stacktrace?.frames) {
        for (const frame of ex.stacktrace.frames) {
          if (frame.filename) frame.filename = scrubPaths(frame.filename)
          if (frame.abs_path) frame.abs_path = scrubPaths(frame.abs_path)
        }
      }
    }
  }

  return event
}

let sentryInitialized = false
let posthogInstance: typeof import('posthog-js').default | null = null

export function initSentry(anonymousId: AnonymousTelemetryId): void {
  if (sentryInitialized) return

  const { sentryDsn, sentryBuildVersion, sentryRelease } = resolveFrontendTelemetryConfig()
  if (!sentryDsn) return

  Sentry.init({
    dsn: sentryDsn,
    release: sentryRelease || undefined,
    sendDefaultPii: false,
    beforeSend: scrubSentryEvent,
  })
  Sentry.setUser({ id: anonymousId })
  if (sentryBuildVersion) {
    const releaseKind = sentryRelease
      ? 'stable'
      : sentryBuildVersion.includes('-') ? 'prerelease' : 'internal'

    Sentry.setTag('rhizome.build_version', sentryBuildVersion)
    Sentry.setTag('rhizome.release_kind', releaseKind)
  }
  sentryInitialized = true
}

export function teardownSentry(): void {
  if (!sentryInitialized) return
  Sentry.close()
  sentryInitialized = false
}

export async function initPostHog(anonymousId: AnonymousTelemetryId, releaseChannel?: ReleaseChannel): Promise<void> {
  if (posthogInstance) return

  const { posthogKey, posthogHost } = resolveFrontendTelemetryConfig()
  if (!posthogKey || !posthogHost) return

  const posthog = (await import('posthog-js')).default
  posthog.init(posthogKey, {
    api_host: posthogHost,
    autocapture: false,
    capture_pageview: false,
    persistence: 'memory',
    disable_session_recording: true,
  })
  posthog.identify(anonymousId, releaseChannel ? { release_channel: releaseChannel } : undefined)
  posthogInstance = posthog
}

export function teardownPostHog(): void {
  if (!posthogInstance) return
  posthogInstance.opt_out_capturing()
  posthogInstance.reset()
  posthogInstance = null
}

export function updatePostHogIdentify(releaseChannel: ReleaseChannel): void {
  posthogInstance?.identify(undefined, { release_channel: releaseChannel })
}

/**
 * Hardcoded defaults when PostHog is unavailable / cache empty.
 * Network shell (command rail + status pills) is the default product UI.
 * Opt out to the legacy status-bar chrome with localStorage
 * `ff_shell_command_rail=false` (or PostHog).
 */
const FEATURE_DEFAULTS: Record<string, boolean> = {
  shell_command_rail: true,
}

let currentReleaseChannel: ReleaseChannel = 'stable'

export function setReleaseChannel(channel: ReleaseChannel): void {
  currentReleaseChannel = channel
}

/** Last channel passed to setReleaseChannel (analytics / callers). */
export function getReleaseChannel(): ReleaseChannel {
  return currentReleaseChannel
}

export function isFeatureEnabled(flagKey: FeatureFlagKey): boolean {
  // PostHog when available; else defaults. Channel is tracked for analytics
  // via setReleaseChannel/getReleaseChannel but no longer forces flags on.
  const fromPosthog = posthogInstance?.isFeatureEnabled(flagKey)
  if (typeof fromPosthog === 'boolean') return fromPosthog
  return (Reflect.get(FEATURE_DEFAULTS, flagKey) as boolean | undefined) ?? false
}

export function trackEvent(name: ProductAnalyticsEventName, properties?: ProductAnalyticsProperties): void {
  posthogInstance?.capture(name, properties)
}

export { scrubPaths as _scrubPathsForTest }
