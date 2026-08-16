import { test, expect } from '@playwright/test'
import {
  openCommandPalette,
  closeCommandPalette,
  findCommand,
  sendShortcut,
  verifyVisible,
  waitForKeyboardShortcutsReady,
} from './helpers'
import { pinNotesShellLaunch } from '../helpers/fixtureVault'

test.describe('Command Palette smoke tests', () => {
  test.beforeEach(async ({ page }) => {
    // Launch defaults to ChatHome once per browser session
    // (`useAppAiWorkspaceBridge`'s `useAgentDefaultOpenChat`), racing the
    // notes-shell mount against the vault-ready check that triggers it.
    // Playwright gives every test a fresh context/session, so without this
    // pin the race is live on every single run: fast machines usually win it
    // (sidebar paints, gets asserted visible, and only then the app swaps to
    // ChatHome underneath the already-passed assertion), but under load the
    // vault-ready effect can fire before the notes shell ever paints, and
    // `sidebar-top-nav` never appears within the 10s budget. Pinning the
    // session flag before `goto` removes the race instead of racing it.
    await pinNotesShellLaunch(page)
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('[data-testid="sidebar-top-nav"]')).toBeVisible({ timeout: 10_000 })
  })

  test('Cmd+K opens the command palette @smoke', async ({ page }) => {
    await openCommandPalette(page)
    await verifyVisible(page, 'input[placeholder="Type a command..."]')
  })

  test('Escape closes the command palette', async ({ page }) => {
    await openCommandPalette(page)
    await closeCommandPalette(page)
    await expect(
      page.locator('input[placeholder="Type a command..."]'),
    ).not.toBeVisible()
  })

  test('typing filters the command list', async ({ page }) => {
    await openCommandPalette(page)
    const found = await findCommand(page, 'reload')
    expect(found).toBe(true)
  })

  test('arrow keys navigate commands', async ({ page }) => {
    await openCommandPalette(page)
    const first = await page
      .locator('[data-selected="true"]')
      .first()
      .textContent()
    await page.keyboard.press('ArrowDown')
    const second = await page
      .locator('[data-selected="true"]')
      .first()
      .textContent()
    expect(first).not.toBe(second)
  })
})

test.describe('Keyboard shortcuts smoke tests', () => {
  test.beforeEach(async ({ page }) => {
    // See the comment in the 'Command Palette smoke tests' beforeEach above:
    // this pins the notes shell so it isn't swapped for ChatHome mid-race.
    await pinNotesShellLaunch(page)
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('[data-testid="sidebar-top-nav"]')).toBeVisible({ timeout: 10_000 })
  })

  test('Cmd+P opens quick open palette @smoke', async ({ page }) => {
    await waitForKeyboardShortcutsReady(page)
    await page.locator('body').click()
    await sendShortcut(page, 'p', ['Control'])
    const searchInput = page.locator('input[placeholder="Search notes..."]')
    await expect(searchInput).toBeVisible()
    // QuickOpenPalette autofocuses its input once mounted; waiting for focus
    // (rather than just visibility) confirms the palette has actually
    // finished settling instead of being mid-mount.
    await expect(searchInput).toBeFocused()
  })

  test('Escape closes command palette after Cmd+K', async ({ page }) => {
    await openCommandPalette(page)
    await page.keyboard.press('Escape')
    await expect(
      page.locator('input[placeholder="Type a command..."]'),
    ).not.toBeVisible()
  })
})
