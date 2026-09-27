import { type Page, expect } from '@playwright/test'

const COMMAND_INPUT = 'input[placeholder="Type a command..."]'
const QUICK_OPEN_INPUT = 'input[placeholder="Search notes..."]'
type KeyboardModifier = 'Meta' | 'Control' | 'Shift' | 'Alt'
const COMMAND_MODIFIER: KeyboardModifier = process.platform === 'darwin' ? 'Meta' : 'Control'

/** How long a smoke test waits for a control that is the readiness condition. */
export const SMOKE_UI_READY_TIMEOUT = 15_000

/**
 * SearchPanel drops a second ArrowUp/ArrowDown when the two keydowns land
 * inside this window. The test waits until the page clock says the window
 * has closed, instead of sleeping a fixed 550ms that can still be inside it
 * when the main thread is busy.
 */
const SEARCH_KEY_DUPLICATE_WINDOW_MS = 500

type KeyupStampWindow = Window & { __rhizomeSmokeKeyupAt?: Record<string, number> }

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
  await page.waitForFunction(() => window.__rhizomeFrontendReady === true, undefined, {
    timeout: 20_000,
  })
}

/**
 * Focus the page without pressing anything. `body.click()` with no position
 * clicks the element's centre, which lands on whatever the layout puts there.
 * The top-left corner is chrome padding in every layout.
 */
export async function focusShellChrome(page: Page): Promise<void> {
  await page.locator('body').click({ position: { x: 2, y: 2 } })
}

async function openByShortcutOnce(
  page: Page,
  key: string,
  ready: ReturnType<Page['locator']>,
): Promise<void> {
  await waitForKeyboardShortcutsReady(page)
  await focusShellChrome(page)
  // A second shortcut toggles the palette shut. Send one only while it is
  // still closed, then wait until the control is actually visible.
  if (!(await ready.isVisible().catch(() => false))) {
    await sendShortcut(page, key, ['Control'])
  }
  await expect(ready).toBeVisible({ timeout: SMOKE_UI_READY_TIMEOUT })
}

export async function openCommandPalette(page: Page): Promise<void> {
  const input = page.locator(COMMAND_INPUT)
  await openByShortcutOnce(page, 'k', input)
  await expect(input).toBeFocused({ timeout: SMOKE_UI_READY_TIMEOUT })
}

export async function openQuickOpenPalette(page: Page): Promise<void> {
  const palette = page.getByTestId('quick-open-palette')
  const input = page.locator(QUICK_OPEN_INPUT)
  await openByShortcutOnce(page, 'p', palette)
  await expect(input).toBeFocused({ timeout: SMOKE_UI_READY_TIMEOUT })
}

export async function closeCommandPalette(page: Page): Promise<void> {
  await page.keyboard.press('Escape')
  await expect(page.locator(COMMAND_INPUT)).not.toBeVisible({ timeout: SMOKE_UI_READY_TIMEOUT })
}

export async function installKeyupStamps(page: Page): Promise<void> {
  await page.evaluate(() => {
    const target = window as KeyupStampWindow
    if (target.__rhizomeSmokeKeyupAt) return
    target.__rhizomeSmokeKeyupAt = {}
    document.addEventListener('keyup', (event) => {
      target.__rhizomeSmokeKeyupAt![event.key] = performance.now()
    }, true)
  })
}

export async function waitUntilKeyupOutsideDuplicateWindow(page: Page, key: string): Promise<void> {
  await expect.poll(async () => page.evaluate(({ watched, windowMs }) => {
    const at = (window as KeyupStampWindow).__rhizomeSmokeKeyupAt?.[watched]
    return typeof at === 'number' && performance.now() - at > windowMs
  }, { watched: key, windowMs: SEARCH_KEY_DUPLICATE_WINDOW_MS }), {
    timeout: SMOKE_UI_READY_TIMEOUT,
  }).toBe(true)
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
    await expect(match).toBeVisible({ timeout: SMOKE_UI_READY_TIMEOUT })
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
  await expect(match).toBeVisible({ timeout: SMOKE_UI_READY_TIMEOUT })
  await page.keyboard.press('Enter')
}

export async function verifyVisible(
  page: Page,
  selector: string,
): Promise<void> {
  await expect(page.locator(selector).first()).toBeVisible()
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

/**
 * Chat is the default centre canvas (ADR-0166). C72 opens Notes (editor-list)
 * on fresh launch; rail Inbox toggles that column. Only click Inbox / restore
 * when the note list is not already visible.
 */
export async function ensureNotesPanelOpen(page: Page) {
  const noteList = page.getByTestId('note-list-container')
  if (await noteList.isVisible().catch(() => false)) return noteList

  // C72: Notes often opens as editor-list. Rail Inbox toggles — do not click it
  // while the vault panel shell is already present (that would close Notes).
  try {
    await noteList.waitFor({ state: 'visible', timeout: 5_000 })
    return noteList
  } catch {
    // fall through to restore / open
  }

  const restore = page.getByTestId('vault-panel-restore')
  if (await restore.isVisible().catch(() => false)) {
    await restore.click()
  } else if (!(await page.getByTestId('vault-panel').isVisible().catch(() => false))) {
    await page.getByTestId('vault-panel-restore').click()
  }
  await expect(noteList).toBeVisible({ timeout: 10_000 })
  return noteList
}

/** Open a vault note into the centre editor beside Chat. */
export async function openNoteFromNotesList(page: Page, title: string): Promise<void> {
  const noteList = await ensureNotesPanelOpen(page)
  await noteList.getByText(title, { exact: true }).click()
  await expectNoteEditorReady(page)
}

/**
 * Wait until the chat-centre note pane is active (not idle) and BlockNote is up.
 * Idle `.app__note-editor--idle` is `display: none` until a note is open.
 */
export async function expectNoteEditorReady(page: Page): Promise<void> {
  await expect(page.locator('.app__note-editor:not(.app__note-editor--idle)')).toBeVisible({
    timeout: 5_000,
  })
  await expect(page.locator('.bn-editor')).toBeVisible({ timeout: 5_000 })
}
