import { type Page, expect } from '@playwright/test'

const COMMAND_INPUT = 'input[placeholder="Type a command..."]'
type KeyboardModifier = 'Meta' | 'Control' | 'Shift' | 'Alt'
const COMMAND_MODIFIER: KeyboardModifier = process.platform === 'darwin' ? 'Meta' : 'Control'

/**
 * The renderer attaches its global keydown listener from a `useEffect` in
 * `useAppKeyboard`, which fires before `FrontendReadyMarker`'s own effect
 * (it is committed as `<RootApp /><FrontendReadyMarker />` — later siblings'
 * passive effects run after earlier siblings' subtrees in the same commit).
 * Under CPU contention the gap between "sidebar is painted" and "the keydown
 * listener is actually attached" widens enough that a synthesized shortcut
 * sent right after `body.click()` can land before anything is listening.
 * Waiting on this flag is a real readiness signal, not a timing guess.
 */
export async function waitForKeyboardShortcutsReady(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__tolariaFrontendReady === true, undefined, {
    timeout: 10_000,
  })
}

export async function openCommandPalette(page: Page): Promise<void> {
  const input = page.locator(COMMAND_INPUT)
  await waitForKeyboardShortcutsReady(page)

  for (let attempt = 0; attempt < 3; attempt += 1) {
    // Focus the page without pressing anything. `body.click()` with no
    // position clicks the element's *centre* — the middle of the window —
    // which lands on whatever the layout happens to put there. It quietly
    // selected a note row the moment the command rail got wider (2026-08-20),
    // and the resulting failure looked like a note-creation bug three steps
    // later. The top-left corner is chrome padding in every layout.
    await page.locator('body').click({ position: { x: 2, y: 2 } })
    await sendShortcut(page, 'k', ['Control'])

    try {
      await input.waitFor({ state: 'visible', timeout: 2_000 })
      await expect(input).toBeFocused({ timeout: 2_000 })
      return
    } catch {
      if (attempt === 2) {
        throw new Error('Command palette did not open after 3 shortcut attempts')
      }
    }
  }
}

export async function closeCommandPalette(page: Page): Promise<void> {
  await page.keyboard.press('Escape')
  await expect(page.locator(COMMAND_INPUT)).not.toBeVisible()
}

export async function installMockAiAgent(page: Page): Promise<void> {
  await page.addInitScript(() => {
    type Handler = (args?: Record<string, unknown>) => unknown
    type BrowserWindow = Window & typeof globalThis & {
      __mockHandlers?: Record<string, Handler>
    }

    const installMockAgent = (handlers?: Record<string, Handler> | null) => {
      if (!handlers) return handlers ?? null
      handlers.get_ai_agents_status = () => ({
        claude_code: { installed: true, version: 'mock' },
        codex: { installed: false, version: null },
        opencode: { installed: false, version: null },
        pi: { installed: false, version: null },
        gemini: { installed: false, version: null },
        kiro: { installed: false, version: null },
      })
      return handlers
    }

    const browserWindow = window as BrowserWindow
    let ref = installMockAgent(browserWindow.__mockHandlers) ?? null
    Object.defineProperty(browserWindow, '__mockHandlers', {
      configurable: true,
      set(value) {
        ref = installMockAgent(value as Record<string, Handler> | undefined) ?? null
      },
      get() {
        return installMockAgent(ref) ?? ref
      },
    })
  })
}

export async function findCommand(
  page: Page,
  name: string,
): Promise<boolean> {
  await page.locator(COMMAND_INPUT).fill(name)
  const match = page.locator('[data-selected="true"]').first()
  try {
    await match.waitFor({ timeout: 2_000 })
    const text = await match.textContent()
    return text?.toLowerCase().includes(name.toLowerCase()) ?? false
  } catch {
    return false
  }
}

export async function executeCommand(
  page: Page,
  name: string,
): Promise<void> {
  await page.locator(COMMAND_INPUT).fill(name)
  const match = page.locator('[data-selected="true"]').first()
  await match.waitFor({ timeout: 2_000 })
  await page.keyboard.press('Enter')
}

export async function verifyVisible(
  page: Page,
  selector: string,
): Promise<void> {
  await expect(page.locator(selector).first()).toBeVisible()
}

export async function verifyFocusable(
  page: Page,
  selector: string,
): Promise<void> {
  const el = page.locator(selector).first()
  await expect(el).toBeVisible()
  await el.focus()
  await expect(el).toBeFocused()
}

export async function sendShortcut(
  page: Page,
  key: string,
  modifiers: KeyboardModifier[] = [],
): Promise<void> {
  const normalizedModifiers = modifiers.map((modifier) =>
    modifier === 'Control' ? COMMAND_MODIFIER : modifier,
  )
  const combo = [...new Set(normalizedModifiers), key].join('+')
  await page.keyboard.press(combo)
}
