import updaterUserMessages from '../shared/updaterUserMessages.json'
import { RELEASE_DOWNLOAD_PAGE_URL } from '../utils/releaseDownloadPage'

/** User-facing updater copy shared with `src-tauri/src/app_updater.rs`. */
export const UPDATER_USER_MESSAGES = updaterUserMessages

export const UPDATER_CHECK_FAILED_MESSAGE = updaterUserMessages.checkFailed

/** Exact strings `check_for_app_update` may return to the manual check UI. */
export const UPDATER_ALLOWLISTED_CHECK_ERROR_MESSAGES = new Set<string>([
  updaterUserMessages.inAppUpdatesUnavailable,
  updaterUserMessages.checkFailed,
])

export function isAllowlistedUpdaterCheckError(detail: string): boolean {
  return UPDATER_ALLOWLISTED_CHECK_ERROR_MESSAGES.has(detail)
}

/** Releases page URL for updater copy that points people at manual downloads. */
export { RELEASE_DOWNLOAD_PAGE_URL }
