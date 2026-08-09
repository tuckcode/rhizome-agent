import { test, expect } from '@playwright/test'

test.describe('Vault Picker Local Options', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5240')
    await page.waitForSelector('text=notes', { timeout: 10000 })
  })

  test('vault menu shows local folder options', async ({ page }) => {
    // Screenshot before opening menu
    await page.screenshot({ path: 'test-results/vault-picker-before.png', fullPage: true })

    // Click the vault button in the status bar to open the menu
    const vaultButton = page.locator('[title="Switch vault"]')
    await expect(vaultButton).toBeVisible()
    await vaultButton.click()

    // Wait for menu to appear
    await page.waitForTimeout(300)

    // Verify all three options are visible
    await expect(page.locator('text=Open local folder')).toBeVisible()
    await expect(page.locator('text=Create new vault')).toBeVisible()
    await expect(page.locator('text=Connect GitHub repo')).toBeVisible()

    // Screenshot with menu open showing all options
    await page.screenshot({ path: 'test-results/vault-picker-menu-open.png', fullPage: true })
  })

  test('vault menu options have correct test IDs', async ({ page }) => {
    const vaultButton = page.locator('[title="Switch vault"]')
    await vaultButton.click()
    await page.waitForTimeout(200)

    await expect(page.locator('[data-testid="vault-menu-open-local"]')).toBeVisible()
    await expect(page.locator('[data-testid="vault-menu-create-new"]')).toBeVisible()
    await expect(page.locator('[data-testid="vault-menu-connect-github"]')).toBeVisible()
  })
})
