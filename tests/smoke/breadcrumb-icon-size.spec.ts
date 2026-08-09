import { test, expect, type Page } from '@playwright/test'
import { createFixtureVaultCopy, openFixtureVault, removeFixtureVaultCopy } from '../helpers/fixtureVault'

let tempVaultDir: string

async function expectIconSize(buttonName: string, page: Page) {
  const icon = page.getByRole('button', { name: buttonName }).locator('svg')
  await expect(icon).toBeVisible({ timeout: 5_000 })
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

  test('breadcrumb action icons render at the pre-regression 16px size', async ({ page }) => {
    await openFixtureVault(page, tempVaultDir)
    await selectAlphaProject(page)

    await expect(page.locator('.breadcrumb-bar')).toBeVisible({ timeout: 5_000 })

    await expectIconSize('Search within this note', page)
    await expectIconSize('Open the raw editor', page)
    await expectIconSize('Open the AI panel', page)
    await expectIconSize('Archive this note', page)
  })
})
