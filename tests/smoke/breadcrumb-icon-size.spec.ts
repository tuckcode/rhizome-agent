import { test, expect, type Page } from '@playwright/test'
import { createFixtureVaultCopy, openFixtureVault, removeFixtureVaultCopy } from '../helpers/fixtureVault'
import { chooseNotePlacement } from '../helpers/noteActions'

let tempVaultDir: string

async function expectIconSize(buttonName: string, page: Page) {
  const button = page.locator('.breadcrumb-bar').getByRole('button', { name: buttonName })
  const icon = button.locator('svg')
  await expect(button).toBeVisible({ timeout: 5_000 })
  await expect(icon).toBeVisible({ timeout: 5_000 })
  const buttonBox = await button.boundingBox()
  expect(buttonBox?.width).toBeGreaterThanOrEqual(32)
  expect(buttonBox?.height).toBeGreaterThanOrEqual(32)
  const box = await icon.boundingBox()
  expect(box?.width).toBeGreaterThanOrEqual(15)
  expect(box?.width).toBeLessThanOrEqual(17)
  expect(box?.height).toBeGreaterThanOrEqual(15)
  expect(box?.height).toBeLessThanOrEqual(17)
}

async function selectAlphaProject(page: Page) {
  await expect(async () => {
    const note = page
      .locator('[data-testid="note-list-container"]')
      .getByText('Alpha Project', { exact: true })
      .first()
    await expect(note).toBeVisible({ timeout: 5_000 })
    await note.click({ timeout: 5_000 })
  }).toPass({ timeout: 10_000 })
}

test.describe('Breadcrumb action icon size regression', () => {
  test.beforeEach(() => {
    tempVaultDir = createFixtureVaultCopy()
  })

  test.afterEach(() => {
    removeFixtureVaultCopy(tempVaultDir)
  })

  test('breadcrumb actions keep 32px hitboxes around 16px icons @smoke', async ({ page }) => {
    await openFixtureVault(page, tempVaultDir)
    await selectAlphaProject(page)

    await expect(page.locator('.breadcrumb-bar')).toBeVisible({ timeout: 5_000 })
    // A note opens beside Chat and folds its actions into "…" when that pane
    // is narrow. On top gives the full width, where the actions sit inline.
    await chooseNotePlacement(page, 'top')

    await expectIconSize('Add to favorites', page)
    await expectIconSize('Set note as organized', page)
    await expectIconSize('Reload vault', page)
    await expectIconSize('Show the note source', page)
    await expectIconSize('More note actions', page)
    await expectIconSize('Open the properties panel', page)
  })
})
