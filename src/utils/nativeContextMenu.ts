/**
 * Surfaces where the OS/WebKit context menu should stay enabled.
 *
 * Tauri installs a capture-phase `preventDefault` on `contextmenu` so WKWebView
 * does not steal the click before React custom menus. Chat text and the
 * composer still need Copy / Paste / Select All — Atticus hit that gap while
 * daily-driving (2026-09-06).
 */
export const NATIVE_CONTEXT_MENU_ALLOWLIST = [
  '.tldraw-whiteboard',
  '[data-allow-native-context-menu]',
  '[data-testid="agent-input"]',
  '[data-testid="ai-message"]',
  '[data-testid="ai-response-block"]',
  '[data-testid="ai-local-marker"]',
].join(', ')

export function shouldAllowNativeContextMenu(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(NATIVE_CONTEXT_MENU_ALLOWLIST) !== null
}
