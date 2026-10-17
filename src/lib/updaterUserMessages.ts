import updaterUserMessages from '../shared/updaterUserMessages.json'
import { RELEASE_DOWNLOAD_PAGE_URL } from '../utils/releaseDownloadPage'

/** User-facing updater copy shared with `src-tauri/src/app_updater.rs`. */
export const UPDATER_USER_MESSAGES = updaterUserMessages

export const UPDATER_CHECK_FAILED_MESSAGE = updaterUserMessages.checkFailed

/** Releases page URL for updater copy that points people at manual downloads. */
export { RELEASE_DOWNLOAD_PAGE_URL }
