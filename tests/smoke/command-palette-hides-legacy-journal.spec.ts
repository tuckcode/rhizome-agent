import fs from 'fs'
import path from 'path'
import { test, expect } from '@playwright/test'
import {
  createFixtureVaultCopy,
  openFixtureVault,
  removeFixtureVaultCopy,
} from '../helpers/fixtureVault'
import { openCommandPalette } from './helpers'

let tempVaultDir: string

function seedExplicitJournalTypeVault(vaultPath: string): void {
  fs.writeFileSync(path.join(vaultPath, 'journal.md'), `---
type: Type
order: 12
icon: book-bookmark
color: yellow
---

# Journal
`)

  fs.writeFileSync(path.join(vaultPath, 'daily-log.md'), `---
title: Daily Log
type: Journal
---

# Daily Log
`)
}

test.describe('explicit Journal type stays visible across navigation surfaces', () => {
  test.beforeEach(() => {
    tempVaultDir = createFixtureVaultCopy()
    seedExplicitJournalTypeVault(tempVaultDir)
  })

  test.afterEach(() => {
    removeFixtureVaultCopy(tempVaultDir)
  })

  test('explicit Journal type appears in the sidebar and command palette', async ({ page }) => {
    await openFixtureVault(page, tempVaultDir)

    await expect(page.locator('nav').getByText('Journals', { exact: true })).toBeVisible()

    await openCommandPalette(page)
    await page.locator('input[placeholder="Type a command..."]').fill('journal')

    await expect(page.getByText('List Journals', { exact: true })).toBeVisible()
    await expect(page.getByText('New Journal', { exact: true })).toBeVisible()
  })
})
