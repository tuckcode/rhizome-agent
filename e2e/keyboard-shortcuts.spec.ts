import { test, expect } from '@playwright/test'

test('Cmd+N opens create note dialog', async ({ page }) => {
  await page.goto('/')
  await page.waitForTimeout(500)

  await page.keyboard.press('Meta+n')
  await page.waitForTimeout(200)

  await expect(page.locator('.create-dialog')).toBeVisible()
  await expect(page.locator('.create-dialog__title')).toHaveText('Create New Note')
})

test('Cmd+S shows save toast', async ({ page }) => {
  await page.goto('/')
  await page.waitForTimeout(500)

  await page.keyboard.press('Meta+s')
  await page.waitForTimeout(200)

  await expect(page.locator('.toast')).toBeVisible()
  await expect(page.locator('.toast')).toHaveText('Saved')

  await page.screenshot({ path: 'test-results/save-toast.png', fullPage: true })
})

test('Cmd+W closes the active tab', async ({ page }) => {
  await page.goto('/')
  await page.waitForTimeout(500)

  // Open a note
  await page.click('.note-list__item')
  await page.waitForTimeout(300)
  await expect(page.locator('.editor__tab--active')).toBeVisible()

  // Close it with Cmd+W
  await page.keyboard.press('Meta+w')
  await page.waitForTimeout(300)

  // Tab should be gone, placeholder should show
  await expect(page.locator('.editor__tab')).not.toBeVisible()
  await expect(page.locator('.editor__placeholder')).toBeVisible()
})
