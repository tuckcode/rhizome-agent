import { useCallback, useEffect, useRef, useState } from 'react'
import { callHost } from '../lib/callHost'
import {
  trackEngineUpdateAccepted,
  trackEngineUpdateFailed,
  trackEngineUpdateOffered,
  type EngineUpdateFailReason,
} from '../lib/productAnalytics'
import { openExternalUrl } from '../utils/url'

export type { EngineUpdateFailReason }

export interface PrimeReleaseInfo {
  version: string
  notes: string
  url: string
}

export type EngineUpdateMethod = 'npm' | 'homebrew' | 'mise' | 'asdf' | 'unknown'

export interface ApplyPrimeUpdateResult {
  previousVersion: string
  installedVersion: string
  method: EngineUpdateMethod
}

export type PrimeUpdateStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | ({ state: 'available' } & PrimeReleaseInfo)
  | { state: 'error' }
  | ({ state: 'applying' } & PrimeReleaseInfo)
  | ({
      state: 'applied'
      previousVersion: string
      installedVersion: string
      method: EngineUpdateMethod
    } & PrimeReleaseInfo)
  | ({
      state: 'failed'
      message: string
      reason: EngineUpdateFailReason
      method?: EngineUpdateMethod
    } & PrimeReleaseInfo)

export interface PrimeUpdateActions {
  checkForPrimeUpdate: () => Promise<void>
  /**
   * Fallback only. The primary path is `applyEngineUpdate`. Use this when
   * apply fails because the install method is unknown, mise, or asdf.
   */
  openPrimeReleasePage: () => void
  applyEngineUpdate: () => Promise<void>
}

const BUSY_MESSAGE = 'Chat is still answering. Wait until the reply finishes, then update.'
const GENERIC_FAIL_MESSAGE = 'The Chat engine update failed.'

function hostErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message
  if (typeof error === 'string' && error.trim()) return error
  return ''
}

function toChatEngineWording(message: string): string {
  return message.replace(/\bPrime\b/g, 'Chat engine')
}

function classifyEngineUpdateFailure(error: unknown): {
  reason: EngineUpdateFailReason
  message: string
  method?: EngineUpdateMethod
} {
  const raw = hostErrorMessage(error)
  const lower = raw.toLowerCase()
  if (raw.includes('Chat is still answering') || lower.includes('chat is still answering')) {
    return { reason: 'busy', message: BUSY_MESSAGE }
  }
  if (lower.includes('stale') || lower.includes('expected version')) {
    return { reason: 'stale', message: toChatEngineWording(raw) }
  }
  if (lower.includes('not installed') || lower.includes('missing')) {
    return { reason: 'missing', message: toChatEngineWording(raw) }
  }
  // Rust mise / asdf / unknown failures share this copy. They do not name
  // the method, so match the release-page line rather than the method word.
  if (lower.includes('release page')) {
    return {
      reason: 'unknown',
      message: toChatEngineWording(raw) || GENERIC_FAIL_MESSAGE,
      method: 'unknown',
    }
  }
  if (lower.includes('asdf')) {
    return { reason: 'failed', message: toChatEngineWording(raw), method: 'asdf' }
  }
  if (lower.includes('mise')) {
    return { reason: 'failed', message: toChatEngineWording(raw), method: 'mise' }
  }
  if (raw) {
    return { reason: 'failed', message: toChatEngineWording(raw) }
  }
  return { reason: 'unknown', message: GENERIC_FAIL_MESSAGE }
}

function isReleaseStatus(
  status: PrimeUpdateStatus,
): status is Extract<PrimeUpdateStatus, { version: string }> {
  return (
    status.state === 'available' ||
    status.state === 'applying' ||
    status.state === 'applied' ||
    status.state === 'failed'
  )
}

/**
 * Checks whether a newer Chat engine release is available than the version
 * Rhizome learned from the daemon handshake (`primeVersion`, typically
 * `usePrimeHostStatus().version`). `null`/undefined means the engine has not
 * connected yet, so there is nothing to compare and the check is skipped.
 *
 * Apply never runs from this hook on its own. `applyEngineUpdate` is the only
 * write path, and it waits for a click.
 */
export function usePrimeUpdate(
  primeVersion: string | null | undefined,
  chatBusy = false,
): {
  status: PrimeUpdateStatus
  actions: PrimeUpdateActions
} {
  const [status, setStatus] = useState<PrimeUpdateStatus>({ state: 'idle' })
  const releaseUrlRef = useRef<string | null>(null)
  const releaseRef = useRef<PrimeReleaseInfo | null>(null)
  const statusRef = useRef<PrimeUpdateStatus>({ state: 'idle' })
  const chatBusyRef = useRef(chatBusy)
  const offeredVersionRef = useRef<string | null>(null)

  useEffect(() => {
    chatBusyRef.current = chatBusy
  }, [chatBusy])

  useEffect(() => {
    statusRef.current = status
  }, [status])

  const checkForPrimeUpdate = useCallback(async (): Promise<void> => {
    if (!primeVersion) return
    if (statusRef.current.state === 'applying') return

    setStatus({ state: 'checking' })

    try {
      const release = await callHost<PrimeReleaseInfo | null>('check_prime_update', {
        installedVersion: primeVersion,
      })

      if (!release) {
        releaseUrlRef.current = null
        releaseRef.current = null
        setStatus({ state: 'idle' })
        return
      }

      releaseUrlRef.current = release.url
      releaseRef.current = release
      if (offeredVersionRef.current !== release.version) {
        offeredVersionRef.current = release.version
        trackEngineUpdateOffered(release.version)
      }
      setStatus({ state: 'available', ...release })
    } catch (error) {
      console.warn('[prime-update] Failed to check for updates', error)
      setStatus({ state: 'error' })
    }
  }, [primeVersion])

  useEffect(() => {
    if (!primeVersion) return

    const timer = setTimeout(() => { void checkForPrimeUpdate() }, 3000)
    return () => clearTimeout(timer)
  }, [primeVersion, checkForPrimeUpdate])

  const openPrimeReleasePage = useCallback(() => {
    const url = releaseUrlRef.current
    if (!url) return
    openExternalUrl(url)
  }, [])

  const applyEngineUpdate = useCallback(async (): Promise<void> => {
    const current = statusRef.current
    const release = isReleaseStatus(current) ? current : releaseRef.current
    if (!release) return
    if (current.state === 'applying' || current.state === 'applied') return

    const expectedVersion = release.version
    trackEngineUpdateAccepted(expectedVersion)
    setStatus({
      state: 'applying',
      version: release.version,
      notes: release.notes,
      url: release.url,
    })

    try {
      const result = await callHost<ApplyPrimeUpdateResult>('apply_prime_update', {
        expectedVersion,
        chatBusy: chatBusyRef.current,
      })
      setStatus({
        state: 'applied',
        version: release.version,
        notes: release.notes,
        url: release.url,
        previousVersion: result.previousVersion,
        installedVersion: result.installedVersion,
        method: result.method,
      })
    } catch (error) {
      const classified = classifyEngineUpdateFailure(error)
      trackEngineUpdateFailed(classified.reason)
      setStatus({
        state: 'failed',
        version: release.version,
        notes: release.notes,
        url: release.url,
        message: classified.message,
        reason: classified.reason,
        method: classified.method,
      })
    }
  }, [])

  return {
    status,
    actions: { checkForPrimeUpdate, openPrimeReleasePage, applyEngineUpdate },
  }
}
