import { test, expect } from '@playwright/test'
import { executeCommand, openCommandPalette } from './helpers'

test('keyboard-created notes omit default status metadata @smoke', async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('[data-testid="sidebar-top-nav"]', { timeout: 10_000 })

  await page.keyboard.press('Meta+n')
  await expect(page.getByTestId('breadcrumb-filename-trigger')).toContainText(/untitled-note-\d+/i, { timeout: 5_000 })

  await openCommandPalette(page)
  await executeCommand(page, 'Toggle Raw')

  const rawEditor = page.locator('.cm-content')
  await expect(rawEditor).toContainText('type: Note')
  await expect(rawEditor).not.toContainText('status:')
})
