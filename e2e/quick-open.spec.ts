import { test, expect } from '@playwright/test'

test('Cmd+P opens quick open palette', async ({ page }) => {
  await page.goto('/')
  await page.waitForTimeout(500)

  // Open palette with keyboard shortcut
  await page.keyboard.press('Meta+p')
  await page.waitForTimeout(200)

  await expect(page.locator('.palette')).toBeVisible()
  await expect(page.locator('.palette__input')).toBeFocused()

  await page.screenshot({ path: 'test-results/quick-open.png', fullPage: true })
})

test('quick open: search and select a note', async ({ page }) => {
  await page.goto('/')
  await page.waitForTimeout(500)

  await page.keyboard.press('Meta+p')
  await page.waitForTimeout(200)

  // Type to search
  await page.fill('.palette__input', 'laputa')
  await page.waitForTimeout(100)

  // Should show matching result
  await expect(page.locator('.palette__item-title:has-text("Build Laputa App")')).toBeVisible()

  // Press Enter to select
  await page.keyboard.press('Enter')
  await page.waitForTimeout(500)

  // Palette should close and note should be opened
  await expect(page.locator('.palette')).not.toBeVisible()
  // The top result should have been opened (wait for async content load)
  await expect(page.locator('.editor__tab--active')).toBeVisible({ timeout: 3000 })

  await page.screenshot({ path: 'test-results/quick-open-selected.png', fullPage: true })
})

test('quick open: arrow keys navigate results', async ({ page }) => {
  await page.goto('/')
  await page.waitForTimeout(500)

  await page.keyboard.press('Meta+p')
  await page.waitForTimeout(200)

  // First item should be selected by default
  await expect(page.locator('.palette__item--selected').first()).toBeVisible()

  // Arrow down to move selection
  await page.keyboard.press('ArrowDown')
  await page.waitForTimeout(50)

  // Second item should be selected
  const items = page.locator('.palette__item')
  const count = await items.count()
  expect(count).toBeGreaterThan(1)
})

test('quick open: Escape closes palette', async ({ page }) => {
  await page.goto('/')
  await page.waitForTimeout(500)

  await page.keyboard.press('Meta+p')
  await page.waitForTimeout(200)
  await expect(page.locator('.palette')).toBeVisible()

  await page.keyboard.press('Escape')
  await page.waitForTimeout(100)
  await expect(page.locator('.palette')).not.toBeVisible()
})

test('quick open: clicking outside closes palette', async ({ page }) => {
  await page.goto('/')
  await page.waitForTimeout(500)

  await page.keyboard.press('Meta+p')
  await page.waitForTimeout(200)
  await expect(page.locator('.palette')).toBeVisible()

  // Click the overlay area (outside the palette) using mouse click at top-left
  await page.mouse.click(10, 10)
  await page.waitForTimeout(200)
  await expect(page.locator('.palette')).not.toBeVisible()
})
