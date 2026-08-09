import { test, expect } from '@playwright/test'

test('app loads with four-panel layout', async ({ page }) => {
  await page.goto('/')

  // Verify the four panels are present
  await expect(page.locator('.sidebar')).toBeVisible()
  await expect(page.locator('.note-list')).toBeVisible()
  await expect(page.locator('.editor')).toBeVisible()
  await expect(page.locator('.inspector')).toBeVisible()
})

test('sidebar shows filters and section groups', async ({ page }) => {
  await page.goto('/')
  await page.waitForTimeout(500) // Wait for mock data

  await expect(page.getByRole('heading', { name: 'Laputa' })).toBeVisible()
  // Filters
  await expect(page.locator('.sidebar__filter-item').filter({ hasText: 'All Notes' })).toBeVisible()
  await expect(page.locator('.sidebar__filter-item').filter({ hasText: 'People' })).toBeVisible()
  await expect(page.locator('.sidebar__filter-item').filter({ hasText: 'Events' })).toBeVisible()
  // Section groups (use exact match to avoid collision with note list pills)
  await expect(page.locator('.sidebar__section-label', { hasText: 'PROJECTS' })).toBeVisible()
  await expect(page.locator('.sidebar__section-label', { hasText: 'EXPERIMENTS' })).toBeVisible()
  await expect(page.locator('.sidebar__section-label', { hasText: 'RESPONSIBILITIES' })).toBeVisible()
  await expect(page.locator('.sidebar__section-label', { hasText: 'PROCEDURES' })).toBeVisible()
})
