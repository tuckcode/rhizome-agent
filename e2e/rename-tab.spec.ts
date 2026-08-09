import { test, expect } from '@playwright/test'

test('rename tab by double-clicking', async ({ page }) => {
  await page.goto('/')
  await page.waitForTimeout(2000)

  // Screenshot initial state
  await page.screenshot({ path: 'test-results/rename-01-initial.png', fullPage: true })

  // Click a note in the list using text content
  await page.getByText('Deprecated Workflow').first().click()
  await page.waitForTimeout(500)

  // Screenshot: note opened as tab
  await page.screenshot({ path: 'test-results/rename-02-note-opened.png', fullPage: true })

  // Find the tab title in the tab bar and double-click it
  const tabTitle = page.locator('.group span.truncate').first()
  await expect(tabTitle).toBeVisible({ timeout: 5000 })
  const originalTitle = await tabTitle.textContent()
  console.log(`Original title: "${originalTitle}"`)

  await tabTitle.dblclick()
  await page.waitForTimeout(300)

  // Screenshot: editing mode
  await page.screenshot({ path: 'test-results/rename-03-editing.png', fullPage: true })

  // Verify input appeared
  const editInput = page.locator('.group input')
  await expect(editInput).toBeVisible({ timeout: 3000 })

  // Type new name
  await editInput.fill('Renamed Test Note')
  await page.screenshot({ path: 'test-results/rename-04-typing.png', fullPage: true })

  // Press Enter to save
  await editInput.press('Enter')
  await page.waitForTimeout(1000)

  // Screenshot: after rename
  await page.screenshot({ path: 'test-results/rename-05-saved.png', fullPage: true })

  // Verify tab title changed
  const newTabTitle = page.locator('.group span.truncate').first()
  await expect(newTabTitle).toHaveText('Renamed Test Note')
})

test('cancel rename with Escape', async ({ page }) => {
  await page.goto('/')
  await page.waitForTimeout(2000)

  // Open a note
  await page.getByText('Deprecated Workflow').first().click()
  await page.waitForTimeout(500)

  const tabTitle = page.locator('.group span.truncate').first()
  const originalTitle = await tabTitle.textContent()

  // Double-click to edit
  await tabTitle.dblclick()
  await page.waitForTimeout(300)

  const editInput = page.locator('.group input')
  await expect(editInput).toBeVisible({ timeout: 3000 })

  // Type something different
  await editInput.fill('Will Be Cancelled')

  // Press Escape to cancel
  await editInput.press('Escape')
  await page.waitForTimeout(300)

  // Screenshot: after cancel
  await page.screenshot({ path: 'test-results/rename-06-cancelled.png', fullPage: true })

  // Verify title unchanged
  const afterTitle = page.locator('.group span.truncate').first()
  await expect(afterTitle).toHaveText(originalTitle!)
})
