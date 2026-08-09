import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { createFixtureVaultCopy, openFixtureVaultDesktopHarness, removeFixtureVaultCopy } from '../helpers/fixtureVault'

let tempVaultDir: string

function alphaProjectPath(vaultPath: string): string {
  return path.join(vaultPath, 'project', 'alpha-project.md')
}

test.describe('Number property editing', () => {
  test.beforeEach(async ({ page }) => {
    tempVaultDir = createFixtureVaultCopy()
    await openFixtureVaultDesktopHarness(page, tempVaultDir)
    await page.setViewportSize({ width: 1600, height: 900 })
  })

  test.afterEach(() => {
    removeFixtureVaultCopy(tempVaultDir)
  })

  test('properties panel saves number values across raw-mode switches and note reloads @smoke', async ({ page }) => {
    const notePath = alphaProjectPath(tempVaultDir)
    const noteList = page.getByTestId('note-list-container')

    await noteList.getByText('Alpha Project', { exact: true }).click()
    await page.keyboard.press('Control+Shift+i')
    await expect(page.getByTestId('add-property-row')).toBeVisible()

    await page.getByTestId('add-property-row').focus()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('add-property-form')).toBeVisible()

    await page.keyboard.type('Estimate')
    await page.getByTestId('add-property-type-trigger').click()
    await page.getByRole('option', { name: 'Number', exact: true }).click()
    const numberInput = page.getByTestId('add-property-number-input')
    await expect(numberInput).toBeVisible()
    await numberInput.focus()
    await page.keyboard.type(' -12.5 ')
    await page.keyboard.press('Enter')

    await expect.poll(() => fs.readFileSync(notePath, 'utf8')).toContain('Estimate: -12.5')
    await expect(page.getByTestId('number-display')).toContainText('-12.5')

    await page.keyboard.press('Control+Backslash')
    const rawEditor = page.locator('.cm-content')
    await expect(rawEditor).toBeVisible()
    await expect(rawEditor).toContainText('Estimate: -12.5')
    await page.keyboard.press('Control+Backslash')

    await page.reload({ waitUntil: 'networkidle' })
    await noteList.getByText('Alpha Project', { exact: true }).click()
    await page.keyboard.press('Control+Shift+i')
    await expect(page.getByTestId('number-display')).toContainText('-12.5')
  })
})
