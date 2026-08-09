import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.waitForTimeout(500) // Wait for mock data
})

test('All Notes shows all entries', async ({ page }) => {
  const count = page.locator('.note-list__count')
  await expect(count).toHaveText('12')
})

test('clicking People filter shows only people', async ({ page }) => {
  await page.click('text=People')
  await page.waitForTimeout(100)
  const count = page.locator('.note-list__count')
  await expect(count).toHaveText('1')
  await expect(page.locator('.note-list__title', { hasText: 'Matteo Cellini' })).toBeVisible()
  await page.screenshot({ path: 'test-results/filter-people.png' })
})

test('clicking Events filter shows only events', async ({ page }) => {
  await page.click('text=Events')
  await page.waitForTimeout(100)
  const count = page.locator('.note-list__count')
  await expect(count).toHaveText('1')
  await expect(page.locator('.note-list__title', { hasText: 'Laputa App Design Session' })).toBeVisible()
  await page.screenshot({ path: 'test-results/filter-events.png' })
})

test('clicking PROJECTS header shows all projects', async ({ page }) => {
  await page.click('text=PROJECTS')
  await page.waitForTimeout(100)
  const count = page.locator('.note-list__count')
  await expect(count).toHaveText('1')
  await expect(page.locator('.note-list__title', { hasText: 'Build Laputa App' })).toBeVisible()
  await page.screenshot({ path: 'test-results/filter-projects.png' })
})

test('clicking specific entity shows it pinned with children', async ({ page }) => {
  await page.locator('.sidebar__item', { hasText: 'Build Laputa App' }).click()
  await page.waitForTimeout(100)
  // Pinned entity + children that belongTo this project
  await expect(page.locator('.note-list__title', { hasText: 'Build Laputa App' })).toBeVisible()
  await expect(page.locator('.note-list__title', { hasText: 'Facebook Ads Strategy' })).toBeVisible()
  await expect(page.locator('.note-list__title', { hasText: 'Budget Allocation' })).toBeVisible()
  await expect(page.locator('.note-list__item--pinned')).toBeVisible()
  await page.screenshot({ path: 'test-results/filter-entity.png' })
})

test('clicking topic shows entries related to that topic', async ({ page }) => {
  await page.locator('.sidebar__topic-item', { hasText: 'Software Development' }).click()
  await page.waitForTimeout(100)
  await expect(page.locator('.note-list__title', { hasText: 'Build Laputa App' })).toBeVisible()
  await page.screenshot({ path: 'test-results/filter-topic.png' })
})

test('search bar filters by title substring', async ({ page }) => {
  await page.fill('.note-list__search-input', 'budget')
  await page.waitForTimeout(100)
  const count = page.locator('.note-list__count')
  await expect(count).toHaveText('1')
  await expect(page.locator('.note-list__title', { hasText: 'Budget Allocation' })).toBeVisible()
  await expect(page.locator('.note-list__title', { hasText: 'Build Laputa App' })).not.toBeVisible()
  await page.screenshot({ path: 'test-results/search-budget.png' })
})

test('type filter pills narrow results', async ({ page }) => {
  // Click "Projects" pill
  await page.locator('.note-list__pill', { hasText: 'Projects' }).click()
  await page.waitForTimeout(100)
  const count = page.locator('.note-list__count')
  await expect(count).toHaveText('1')
  await expect(page.locator('.note-list__title', { hasText: 'Build Laputa App' })).toBeVisible()
  await expect(page.locator('.note-list__title', { hasText: 'Matteo Cellini' })).not.toBeVisible()
  await page.screenshot({ path: 'test-results/pill-projects.png' })

  // Click "All" to reset
  await page.locator('.note-list__pill', { hasText: 'All' }).click()
  await page.waitForTimeout(100)
  await expect(count).toHaveText('12')
})
