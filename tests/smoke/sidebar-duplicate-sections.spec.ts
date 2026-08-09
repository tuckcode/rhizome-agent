import { test, expect } from '@playwright/test'

test.describe('Sidebar duplicate sections', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('no duplicate sidebar section headers', async ({ page }) => {
    // Verify that every section label in the sidebar is unique.
    // Before the fix, hyphenated folder names (e.g. monday-ideas/)
    // would produce a different isA than the Type file title,
    // resulting in two sidebar sections for the same type.

    const sidebar = page.locator('.app__sidebar')

    // Wait for at least one Expand/Collapse button (indicates sections rendered)
    await sidebar.locator('button[aria-label*="Collapse"], button[aria-label*="Expand"]').first().waitFor({ timeout: 5000 })

    // Extract section labels from the Expand/Collapse aria-labels
    const buttons = sidebar.locator('button[aria-label*="Collapse"], button[aria-label*="Expand"]')
    const count = await buttons.count()
    const labels: string[] = []
    for (let i = 0; i < count; i++) {
      const ariaLabel = await buttons.nth(i).getAttribute('aria-label')
      // aria-label is like "Collapse Projects" or "Expand Projects"
      const label = ariaLabel?.replace(/^(Collapse|Expand)\s+/, '') ?? ''
      if (label) labels.push(label)
    }

    // Every label should be unique — no duplicates
    const uniqueLabels = [...new Set(labels)]
    expect(labels).toEqual(uniqueLabels)
    expect(labels.length).toBeGreaterThan(0)
  })
})
