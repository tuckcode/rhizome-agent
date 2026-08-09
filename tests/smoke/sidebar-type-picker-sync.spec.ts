import fs from 'fs'
import path from 'path'
import { test, expect, type Page } from '@playwright/test'
import {
  createFixtureVaultCopy,
  openFixtureVault,
  removeFixtureVaultCopy,
} from '../helpers/fixtureVault'
import { openCommandPalette } from './helpers'

let tempVaultDir: string

function seedJournalInstanceWithoutType(vaultPath: string): void {
  fs.writeFileSync(path.join(vaultPath, 'daily-log.md'), `---
title: Daily Log
type: Journal
---

# Daily Log
`)
}

async function openSidebarVisibilityPopover(page: Page): Promise<void> {
  const customizeButton = page.getByRole('button', { name: 'Customize sections' })
  await customizeButton.focus()
  await expect(customizeButton).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByText('Show in sidebar', { exact: true })).toBeVisible()
}

async function closeSidebarVisibilityPopover(page: Page): Promise<void> {
  const customizeButton = page.getByRole('button', { name: 'Customize sections' })
  await customizeButton.focus()
  await expect(customizeButton).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByText('Show in sidebar', { exact: true })).toHaveCount(0)
}

async function createTypeFromKeyboard(page: Page, typeName: string): Promise<void> {
  await openCommandPalette(page)
  await page.locator('input[placeholder="Type a command..."]').fill('new type')
  await page.keyboard.press('Enter')

  const typeInput = page.getByPlaceholder('e.g. Recipe, Book, Habit...')
  await expect(page.getByText('Create New Type', { exact: true })).toBeVisible()
  await expect(typeInput).toBeFocused()

  await page.keyboard.type(typeName)
  await page.keyboard.press('Enter')

  await expect(page.getByText('Create New Type', { exact: true })).toHaveCount(0)
}

test.describe('Sidebar type picker stays in sync with live vault types', () => {
  test.beforeEach(() => {
    tempVaultDir = createFixtureVaultCopy()
    seedJournalInstanceWithoutType(tempVaultDir)
  })

  test.afterEach(() => {
    removeFixtureVaultCopy(tempVaultDir)
  })

  test('creating a missing Journal type updates the sidebar visibility picker immediately', async ({ page }) => {
    await openFixtureVault(page, tempVaultDir)

    await expect(page.locator('nav').getByText('Journals', { exact: true })).toHaveCount(0)

    await openSidebarVisibilityPopover(page)
    await expect(page.getByRole('button', { name: 'Toggle Journals' })).toHaveCount(0)
    await closeSidebarVisibilityPopover(page)

    await createTypeFromKeyboard(page, 'Journal')

    await expect(page.locator('nav').getByText('Journals', { exact: true })).toBeVisible()

    await openSidebarVisibilityPopover(page)
    const journalToggle = page.getByRole('button', { name: 'Toggle Journals' })
    await expect(journalToggle).toBeVisible()
    await journalToggle.focus()
    await expect(journalToggle).toBeFocused()
    await page.keyboard.press('Space')
    await closeSidebarVisibilityPopover(page)

    await expect(page.locator('nav').getByText('Journals', { exact: true })).toHaveCount(0)
  })
})
