import { Fragment, createElement, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import updaterUserMessages from '../shared/updaterUserMessages.json'
import { RELEASE_DOWNLOAD_PAGE_URL } from '../utils/releaseDownloadPage'
import { openExternalUrl } from '../utils/url'

/** User-facing updater copy shared with `src-tauri/src/app_updater.rs`. */
export const UPDATER_USER_MESSAGES = updaterUserMessages

export const UPDATER_CHECK_FAILED_MESSAGE = updaterUserMessages.checkFailed
export const UPDATER_INSTALL_FAILED_MESSAGE = updaterUserMessages.installFailed

/** Link label shared across updater sentences that point at manual downloads. */
export const UPDATER_RELEASES_PAGE_LABEL = 'Releases page'

/** `{found}` token in version-changed copy must look like a release version, not free text. */
export const UPDATER_VERSION_CHANGED_FOUND_PATTERN = /^v?\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/

const UPDATER_MESSAGES_WITH_RELEASES_PAGE_LINK = new Set<string>([
  updaterUserMessages.inAppUpdatesUnavailable,
  updaterUserMessages.installFailed,
])

/** Exact strings `check_for_app_update` may return to the manual check UI. */
export const UPDATER_ALLOWLISTED_CHECK_ERROR_MESSAGES = new Set<string>([
  updaterUserMessages.inAppUpdatesUnavailable,
  updaterUserMessages.checkFailed,
])

/** Exact strings `download_and_install_app_update` may return to the UI. */
export const UPDATER_ALLOWLISTED_INSTALL_ERROR_MESSAGES = new Set<string>([
  updaterUserMessages.inAppUpdatesUnavailable,
  updaterUserMessages.checkFailed,
  updaterUserMessages.installFailed,
  updaterUserMessages.noUpdateToInstall,
])

export function isAllowlistedUpdaterCheckError(detail: string): boolean {
  return UPDATER_ALLOWLISTED_CHECK_ERROR_MESSAGES.has(detail)
}

export function parseVersionChangedFoundToken(detail: string): string | null {
  const template = updaterUserMessages.versionChangedWhileDownloading
  const marker = '{found}'
  const markerIndex = template.indexOf(marker)
  if (markerIndex === -1) return null

  const prefix = template.slice(0, markerIndex)
  const suffix = template.slice(markerIndex + marker.length)
  if (!detail.startsWith(prefix) || !detail.endsWith(suffix)) return null

  return detail.slice(prefix.length, detail.length - suffix.length)
}

export function isValidVersionChangedFoundToken(found: string): boolean {
  return UPDATER_VERSION_CHANGED_FOUND_PATTERN.test(found.trim())
}

export function isAllowlistedUpdaterVersionChangedMessage(detail: string): boolean {
  const found = parseVersionChangedFoundToken(detail)
  if (!found) return false
  return isValidVersionChangedFoundToken(found)
}

export function isAllowlistedUpdaterInstallError(detail: string): boolean {
  return UPDATER_ALLOWLISTED_INSTALL_ERROR_MESSAGES.has(detail)
    || isAllowlistedUpdaterVersionChangedMessage(detail)
}

/** Only exact updater copy (not arbitrary toast text) may link the Releases page label. */
export function shouldLinkUpdaterReleasesPage(message: string): boolean {
  return UPDATER_MESSAGES_WITH_RELEASES_PAGE_LINK.has(message)
}

/** Releases page URL for updater copy that points people at manual downloads. */
export { RELEASE_DOWNLOAD_PAGE_URL }

export function renderUpdaterUserMessage(
  message: string,
  options?: { linkReleasesPage?: boolean },
): ReactNode {
  const linkReleasesPage = options?.linkReleasesPage ?? shouldLinkUpdaterReleasesPage(message)
  if (!linkReleasesPage || !message.includes(UPDATER_RELEASES_PAGE_LABEL)) return message

  const segments = message.split(UPDATER_RELEASES_PAGE_LABEL)
  const children: ReactNode[] = []

  segments.forEach((segment, index) => {
    if (segment) children.push(segment)
    if (index < segments.length - 1) {
      children.push(
        createElement(
          Button,
          {
            key: `updater-releases-link-${index}`,
            type: 'button',
            variant: 'link',
            size: 'xs',
            className: 'h-auto p-0 text-inherit underline',
            onClick: () => {
              void openExternalUrl(RELEASE_DOWNLOAD_PAGE_URL)
            },
          },
          UPDATER_RELEASES_PAGE_LABEL,
        ),
      )
    }
  })

  return createElement(Fragment, null, ...children)
}
