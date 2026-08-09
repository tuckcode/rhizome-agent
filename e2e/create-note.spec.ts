import { test, expect } from '@playwright/test'

test('clicking + button opens create note dialog', async ({ page }) => {
  await page.goto('/')
  await page.waitForTimeout(500)

  // Click the + button
  await page.click('.note-list__add-btn')
  await page.waitForTimeout(200)

  // Dialog should be visible
  await expect(page.locator('.create-dialog')).toBeVisible()
  await expect(page.locator('.create-dialog__title')).toHaveText('Create New Note')

  await page.screenshot({ path: 'test-results/create-dialog.png', fullPage: true })
})

test('create a new note via dialog', async ({ page }) => {
  await page.goto('/')
  await page.waitForTimeout(500)

  // Open dialog
  await page.click('.note-list__add-btn')
  await page.waitForTimeout(200)

  // Type a title
  await page.fill('.create-dialog__input', 'My Test Note')

  // Select "Project" type
  await page.click('.create-dialog__type-btn:text("Project")')

  // Click Create
  await page.click('.create-dialog__btn--create')
  await page.waitForTimeout(300)

  // Dialog should close
  await expect(page.locator('.create-dialog')).not.toBeVisible()

  // New note should appear in the list and be opened in editor
  await expect(page.locator('.note-list__item:has-text("My Test Note")').first()).toBeVisible()
  await expect(page.locator('.editor__tab--active:has-text("My Test Note")')).toBeVisible()

  await page.screenshot({ path: 'test-results/create-note-result.png', fullPage: true })
})

test('escape closes create dialog', async ({ page }) => {
  await page.goto('/')
  await page.waitForTimeout(500)

  await page.click('.note-list__add-btn')
  await page.waitForTimeout(200)
  await expect(page.locator('.create-dialog')).toBeVisible()

  await page.keyboard.press('Escape')
  await page.waitForTimeout(100)
  await expect(page.locator('.create-dialog')).not.toBeVisible()
})
