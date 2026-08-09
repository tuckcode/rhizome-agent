import { test, expect } from '@playwright/test'

test.describe('Repair Vault — flat structure', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('repair vault executes without errors', async ({ page }) => {
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    // Open command palette and run Repair Vault
    await page.keyboard.press('Meta+k')
    await page.waitForTimeout(300)
    await page.keyboard.type('repair vault')
    await page.waitForTimeout(300)
    await page.keyboard.press('Enter')
    await page.waitForTimeout(1000)

    // No console errors related to repair_vault
    const repairErrors = errors.filter(e => e.includes('repair_vault'))
    expect(repairErrors).toHaveLength(0)
  })

  test('app loads without type folder structure errors', async ({ page }) => {
    const main = page.locator('#root')
    await expect(main).toBeVisible()

    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text())
    })
    await page.waitForTimeout(1000)

    // No errors about move_note_to_type_folder or type folder operations
    const folderErrors = errors.filter(
      e => e.includes('move_note_to_type_folder') || e.includes('type_folder'),
    )
    expect(folderErrors).toHaveLength(0)
  })
})
