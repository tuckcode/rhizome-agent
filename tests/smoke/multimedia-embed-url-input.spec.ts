import { test, expect, type Page } from '@playwright/test'
import { createFixtureVaultCopy, openFixtureVault, removeFixtureVaultCopy } from '../helpers/fixtureVault'

let tempVaultDir: string

test.beforeEach(async ({ page }, testInfo) => {
  testInfo.setTimeout(90_000)
  tempVaultDir = createFixtureVaultCopy()
  await openFixtureVault(page, tempVaultDir)
})

test.afterEach(() => {
  removeFixtureVaultCopy(tempVaultDir)
})

async function openVideoEmbedPanel(page: Page) {
  await page.locator('[data-testid="note-list-container"]').getByText('Alpha Project', { exact: true }).click()
  await expect(page.locator('.bn-editor')).toBeVisible({ timeout: 5_000 })
  await page.locator('.bn-block-content').last().click()
  await page.keyboard.press('Enter')
  await page.keyboard.type('/video')
  await expect(page.getByRole('option', { name: /Video/i })).toBeVisible({ timeout: 5_000 })
  await page.keyboard.press('Enter')

  await page.getByText('Add video', { exact: true }).click()
  await expect(page.getByRole('tab', { name: 'Embed' })).toBeVisible({ timeout: 5_000 })
  await page.getByRole('tab', { name: 'Embed' }).click()
}

test('multimedia embed URL field accepts typed and pasted URLs', async ({ page }) => {
  await openVideoEmbedPanel(page)
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])

  const urlInput = page.getByPlaceholder('Enter URL')
  await expect(urlInput).toBeVisible({ timeout: 5_000 })

  await urlInput.click()
  await page.keyboard.type('https://example.com/typed-video.mp4')
  await expect(urlInput).toHaveValue('https://example.com/typed-video.mp4')

  await urlInput.fill('')
  await urlInput.focus()
  await page.evaluate(() => navigator.clipboard.writeText('https://example.com/pasted-video.mp4'))
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+V' : 'Control+V')
  await expect(urlInput).toHaveValue('https://example.com/pasted-video.mp4')

  await page.getByRole('button', { name: 'Embed video' }).click()
  await expect(page.locator('video.bn-visual-media')).toHaveAttribute('src', 'https://example.com/pasted-video.mp4')
})
