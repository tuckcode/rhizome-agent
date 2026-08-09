import fs from 'fs'
import path from 'path'
import { test, expect, type Page } from '@playwright/test'
import { createFixtureVaultCopy, openFixtureVaultTauri, removeFixtureVaultCopy } from '../helpers/fixtureVault'
import { openCommandPalette, executeCommand } from './helpers'
import { triggerMenuCommand } from './testBridge'

let tempVaultDir: string

async function createUntitledNote(page: Page): Promise<void> {
  await page.locator('body').click()
  await triggerMenuCommand(page, 'file-new-note')
  await expect(page.locator('.bn-editor')).toBeVisible({ timeout: 5_000 })
}

test.beforeEach(async ({ page }, testInfo) => {
  testInfo.setTimeout(90_000)
  tempVaultDir = createFixtureVaultCopy()
  await openFixtureVaultTauri(page, tempVaultDir)
})

test.afterEach(async () => {
  removeFixtureVaultCopy(tempVaultDir)
})

test('@smoke disabling H1 auto-rename keeps untitled filenames until manual sync', async ({ page }) => {
  await openCommandPalette(page)
  await executeCommand(page, 'H1 Auto-Rename')

  const settingsPanel = page.getByTestId('settings-panel')
  await expect(settingsPanel).toBeVisible({ timeout: 5_000 })

  const autoRenameSwitch = page.getByRole('switch', { name: 'Auto-rename untitled notes from first H1' })
  await expect(autoRenameSwitch).toHaveAttribute('aria-checked', 'true')
  await autoRenameSwitch.focus()
  await page.keyboard.press('Space')
  await expect(autoRenameSwitch).toHaveAttribute('aria-checked', 'false')
  await page.keyboard.press('Meta+Enter')
  await expect(settingsPanel).not.toBeVisible({ timeout: 5_000 })

  await createUntitledNote(page)

  const filenameTrigger = page.getByTestId('breadcrumb-filename-trigger')
  const untitledStem = (await filenameTrigger.textContent())?.trim() ?? ''
  expect(untitledStem).toMatch(/^untitled-note-\d+(?:-\d+)?$/i)

  await page.keyboard.type('Manual Sync Title', { delay: 20 })
  await page.keyboard.press('Enter')
  await page.waitForTimeout(2_700)

  await expect(filenameTrigger).toContainText(untitledStem)
  await expect(page.getByTestId('breadcrumb-sync-button')).toBeVisible()
  await expect.poll(() => fs.existsSync(path.join(tempVaultDir, `${untitledStem}.md`))).toBe(true)

  const syncButton = page.getByTestId('breadcrumb-sync-button')
  await syncButton.focus()
  await page.keyboard.press('Enter')

  await expect(filenameTrigger).toContainText('manual-sync-title')
  await expect.poll(() => fs.existsSync(path.join(tempVaultDir, `${untitledStem}.md`))).toBe(false)
  await expect.poll(() => fs.existsSync(path.join(tempVaultDir, 'manual-sync-title.md'))).toBe(true)
})
