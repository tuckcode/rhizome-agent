import { useEffect } from 'react'
import { isTauri } from '../mock-tauri'
import { cleanupTauriEventListeners, type TauriUnlisten } from '../utils/tauriEventCleanup'

/**
 * Emitted by `open_main_from_menu_bar_companion` when a menu-bar roster row is
 * clicked. Payload is the session file path — the same one
 * `switch_prime_session` takes. Mirrors `OPEN_SESSION_EVENT` in
 * `src-tauri/src/menu_bar_companion.rs`; the two names must stay in step.
 */
export const MENU_BAR_OPEN_SESSION_EVENT = 'menu-bar-open-session'

/**
 * Land the main window on the session picked in the menu bar (#13).
 *
 * The popover is a separate webview and cannot drive this window's state, so
 * the Rust side focuses the main window and emits; this is the other half.
 */
export function useMenuBarSessionOpen(onOpenSession: (sessionPath: string) => void) {
  useEffect(() => {
    if (!isTauri()) return

    let disposed = false
    let unlisteners: TauriUnlisten[] = []

    void import('@tauri-apps/api/event')
      .then(({ listen }) => Promise.all([
        listen<string>(MENU_BAR_OPEN_SESSION_EVENT, (event) => {
          // The payload is a path from another process; an empty or non-string
          // value would otherwise switch the panel to a session that isn't one.
          if (typeof event.payload === 'string' && event.payload.length > 0) {
            onOpenSession(event.payload)
          }
        }),
      ]))
      .then((nextUnlisteners) => {
        if (disposed) {
          cleanupTauriEventListeners(nextUnlisteners)
          return
        }
        unlisteners = nextUnlisteners
      })
      .catch(() => undefined)

    return () => {
      disposed = true
      cleanupTauriEventListeners(unlisteners)
    }
  }, [onOpenSession])
}
