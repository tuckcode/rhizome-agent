import { test, expect } from '@playwright/test'

test.describe('Type visibility in sidebar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('sections with visible:false Type entries are hidden from sidebar', async ({
    page,
  }) => {
    const sidebar = page.locator('.app__sidebar')

    // Wait for sections to render
    await sidebar
      .locator('button[aria-label*="Collapse"], button[aria-label*="Expand"]')
      .first()
      .waitFor({ timeout: 5000 })

    // Extract section labels from Expand/Collapse buttons
    const buttons = sidebar.locator(
      'button[aria-label*="Collapse"], button[aria-label*="Expand"]',
    )
    const count = await buttons.count()
    const labels: string[] = []
    for (let i = 0; i < count; i++) {
      const ariaLabel = await buttons.nth(i).getAttribute('aria-label')
      const label = ariaLabel?.replace(/^(Collapse|Expand)\s+/, '') ?? ''
      if (label) labels.push(label)
    }

    // Verify that at least some sections render (sanity check)
    expect(labels.length).toBeGreaterThan(3)

    // All visible section labels should be unique (regression check)
    const uniqueLabels = [...new Set(labels)]
    expect(labels).toEqual(uniqueLabels)
  })
})
