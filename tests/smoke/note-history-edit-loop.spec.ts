import { test, expect, type Page } from '@playwright/test'
import {
  createFixtureVaultCopy,
  openFixtureVault,
  removeFixtureVaultCopy,
} from '../helpers/fixtureVault'
import { sendShortcut } from './helpers'

let tempVaultDir: string

function isReactUpdateLoop(message: string): boolean {
  return (
    message.includes('Maximum update depth') ||
    message.includes('React error #185') ||
    message.includes('#185')
  )
}

function collectReactUpdateLoopErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (error) => {
    if (isReactUpdateLoop(error.message)) errors.push(error.message)
  })
  page.on('console', (message) => {
    if (message.type() === 'error' && isReactUpdateLoop(message.text())) {
      errors.push(message.text())
    }
  })
  return errors
}

async function openNote(page: Page, title: string) {
  await page.getByTestId('note-list-container').getByText(title, { exact: true }).click()
  await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible({ timeout: 5_000 })
}

async function openPropertiesPanel(page: Page) {
  const openProperties = page.getByRole('button', { name: 'Open the properties panel' })
  if (await openProperties.count()) await openProperties.click()
  await expect(page.getByText('History')).toBeVisible({ timeout: 5_000 })
}

async function focusHeadingEnd(page: Page, titlePattern: RegExp | string) {
  const heading = page.getByRole('heading', { name: titlePattern, level: 1 })
  await expect(heading).toBeVisible({ timeout: 5_000 })
  await heading.click()
  await page.keyboard.press('End')
}

test.beforeEach(async ({ page }, testInfo) => {
  testInfo.setTimeout(60_000)
  tempVaultDir = createFixtureVaultCopy()
  await openFixtureVault(page, tempVaultDir)
  await page.setViewportSize({ width: 1180, height: 760 })
})

test.afterEach(() => {
  removeFixtureVaultCopy(tempVaultDir)
})

test('opening note history then editing and saving the same note stays stable @smoke', async ({ page }) => {
  const errors = collectReactUpdateLoopErrors(page)
  const titleSuffix = ` History Loop ${Date.now()}`
  const updatedTitle = `Alpha Project${titleSuffix}`

  await openNote(page, 'Alpha Project')
  await openPropertiesPanel(page)

  await page.getByRole('button', { name: /a1b2c3d.*Update alpha-project with latest changes/i }).click()
  await expect(page.getByText('Updated paragraph at commit a1b2c3d')).toBeVisible({ timeout: 5_000 })

  await page.getByRole('button', { name: 'Return to the editor' }).click()
  await focusHeadingEnd(page, 'Alpha Project')
  await page.keyboard.type(titleSuffix)
  await sendShortcut(page, 's', ['Control'])

  await expect(page.getByRole('heading', { name: updatedTitle, level: 1 })).toBeVisible({ timeout: 5_000 })
  expect(errors).toEqual([])
})
