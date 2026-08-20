import { useCallback, useEffect, useRef, useState } from 'react'
import { callHost } from '../lib/callHost'
import { isTauri } from '../mock-tauri'
import { openExternalUrl } from '../utils/url'

export interface PrimeReleaseInfo {
  version: string
  notes: string
  url: string
}

export type PrimeUpdateStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | ({ state: 'available' } & PrimeReleaseInfo)
  | { state: 'error' }

export interface PrimeUpdateActions {
  checkForPrimeUpdate: () => Promise<void>
  /**
   * Prime never updates unattended — this only opens the real release page
   * so the user runs the update themselves. Rhizome does not know how any
   * given install of `prime-agent` got there (npm, Homebrew, mise, asdf, a
   * manual binary — see `prime_discovery.rs`), so it has no single safe
   * command to run on the user's behalf even with consent.
   */
  openPrimeReleasePage: () => void
}


/**
 * Checks whether a newer Prime release is available than the version
 * Rhizome learned from the daemon handshake (`primeVersion`, typically
 * `usePrimeHostStatus().version`). `null`/undefined means Prime hasn't
 * connected yet, so there's nothing to compare against and the check is
 * skipped rather than guessed.
 */
export function usePrimeUpdate(primeVersion: string | null | undefined): {
  status: PrimeUpdateStatus
  actions: PrimeUpdateActions
} {
  const [status, setStatus] = useState<PrimeUpdateStatus>({ state: 'idle' })
  const releaseUrlRef = useRef<string | null>(null)

  const checkForPrimeUpdate = useCallback(async (): Promise<void> => {
    if (!isTauri()) return
    if (!primeVersion) return

    setStatus({ state: 'checking' })

    try {
      const release = await callHost<PrimeReleaseInfo | null>('check_prime_update', {
        installedVersion: primeVersion,
      })

      if (!release) {
        releaseUrlRef.current = null
        setStatus({ state: 'idle' })
        return
      }

      releaseUrlRef.current = release.url
      setStatus({ state: 'available', ...release })
    } catch (error) {
      console.warn('[prime-update] Failed to check for updates', error)
      setStatus({ state: 'error' })
    }
  }, [primeVersion])

  useEffect(() => {
    if (!isTauri()) return
    if (!primeVersion) return

    const timer = setTimeout(() => { void checkForPrimeUpdate() }, 3000)
    return () => clearTimeout(timer)
  }, [primeVersion, checkForPrimeUpdate])

  const openPrimeReleasePage = useCallback(() => {
    const url = releaseUrlRef.current
    if (!url) return
    openExternalUrl(url)
  }, [])

  return {
    status,
    actions: { checkForPrimeUpdate, openPrimeReleasePage },
  }
}
