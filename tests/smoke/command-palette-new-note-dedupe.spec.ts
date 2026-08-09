import { test, expect } from '@playwright/test'
import { openCommandPalette } from './helpers'

test.describe('Command palette new note command dedupe', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('[data-testid="sidebar-top-nav"]')).toBeVisible({ timeout: 10_000 })
  })

  test('searching new note shows one canonical New Note command with Cmd+N', async ({ page }) => {
    await openCommandPalette(page)

    const commandInput = page.locator('input[placeholder="Type a command..."]')
    await commandInput.fill('new note')

    const newNoteRow = page
      .locator('div.mx-1.flex.cursor-pointer')
      .filter({ has: page.getByText('New Note', { exact: true }) })

    await expect(newNoteRow).toHaveCount(1)
    await expect(newNoteRow.getByText('⌘N', { exact: true })).toBeVisible()

    await expect(page.getByText('Create New Note', { exact: true })).toHaveCount(0)
    await expect(page.getByText('New note', { exact: true })).toHaveCount(0)
  })

  test('searching new ty shows one canonical New Type command and opens the type dialog', async ({ page }) => {
    await openCommandPalette(page)

    const commandInput = page.locator('input[placeholder="Type a command..."]')
    await commandInput.fill('new ty')

    const newTypeRow = page
      .locator('div.mx-1.flex.cursor-pointer')
      .filter({ has: page.getByText('New Type', { exact: true }) })

    await expect(newTypeRow).toHaveCount(1)

    await page.keyboard.press('Enter')
    await expect(page.getByText('Create New Type', { exact: true })).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.getByText('Create New Type', { exact: true })).not.toBeVisible()
  })
})
