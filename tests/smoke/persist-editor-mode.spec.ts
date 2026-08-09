import { test, expect } from '@playwright/test'
import { openCommandPalette, executeCommand } from './helpers'

const RAW_EDITOR = '[data-testid="raw-editor-codemirror"]'
const BLOCKNOTE_EDITOR = '.bn-editor'

test.describe('Persist editor mode (raw/preview) across note switches', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    const noteList = page.locator('[data-testid="note-list-container"]')
    await noteList.waitFor({ timeout: 5_000 })
  })

  test('raw mode persists when switching to a different note', async ({ page }) => {
    const noteItems = page.locator('[data-testid="note-list-container"] .cursor-pointer')

    // Open first note
    await noteItems.nth(0).click()
    await page.waitForTimeout(500)
    await expect(page.locator(BLOCKNOTE_EDITOR).first()).toBeVisible({ timeout: 5_000 })

    // Toggle raw mode on
    await openCommandPalette(page)
    await executeCommand(page, 'Toggle Raw')
    await page.waitForTimeout(500)
    await expect(page.locator(RAW_EDITOR)).toBeVisible({ timeout: 5_000 })

    // Switch to second note — raw mode should persist
    await noteItems.nth(1).click()
    await page.waitForTimeout(500)
    await expect(page.locator(RAW_EDITOR)).toBeVisible({ timeout: 5_000 })
  })

  test('preview mode persists when switching notes', async ({ page }) => {
    const noteItems = page.locator('[data-testid="note-list-container"] .cursor-pointer')

    // Open first note
    await noteItems.nth(0).click()
    await page.waitForTimeout(500)
    await expect(page.locator(BLOCKNOTE_EDITOR).first()).toBeVisible({ timeout: 5_000 })

    // Toggle raw on then off to ensure preview is explicitly set
    await openCommandPalette(page)
    await executeCommand(page, 'Toggle Raw')
    await page.waitForTimeout(300)
    await openCommandPalette(page)
    await executeCommand(page, 'Toggle Raw')
    await page.waitForTimeout(300)
    await expect(page.locator(BLOCKNOTE_EDITOR).first()).toBeVisible({ timeout: 5_000 })

    // Switch to second note — should still be in preview mode
    await noteItems.nth(1).click()
    await page.waitForTimeout(500)
    await expect(page.locator(BLOCKNOTE_EDITOR).first()).toBeVisible({ timeout: 5_000 })
    await expect(page.locator(RAW_EDITOR)).not.toBeVisible()
  })
})
