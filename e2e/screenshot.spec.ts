import { test } from '@playwright/test'

test('capture app screenshot for review', async ({ page }) => {
  await page.goto('/')
  // Wait for mock data to load
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'test-results/app-screenshot.png', fullPage: true })
})

test('capture editor with note selected', async ({ page }) => {
  await page.goto('/')
  await page.waitForTimeout(500)

  // Click the first note in the list
  await page.click('.note-list__item')
  await page.waitForTimeout(300)

  await page.screenshot({ path: 'test-results/editor-screenshot.png', fullPage: true })
})

test('live preview: headings styled, syntax hidden', async ({ page }) => {
  await page.goto('/')
  await page.waitForTimeout(500)

  // Click a note to load it
  await page.click('.note-list__item')
  await page.waitForTimeout(500)

  // Screenshot showing live preview (headings styled, syntax hidden)
  await page.screenshot({ path: 'test-results/live-preview.png', fullPage: true })
})

test('tab bar: multiple tabs open and close', async ({ page }) => {
  await page.goto('/')
  await page.waitForTimeout(500)

  // Click first note
  await page.click('.note-list__item')
  await page.waitForTimeout(500)

  // Debug: screenshot after first click
  await page.screenshot({ path: 'test-results/tabs-debug-1.png', fullPage: true })

  // Check if other items are visible
  const items = await page.locator('.note-list__item').count()
  console.log(`Note list items visible after first click: ${items}`)

  // Click second item if available
  if (items >= 2) {
    await page.locator('.note-list__item').nth(1).click({ timeout: 5000 })
    await page.waitForTimeout(500)
  }

  if (items >= 3) {
    await page.locator('.note-list__item').nth(2).click({ timeout: 5000 })
    await page.waitForTimeout(500)
  }

  await page.screenshot({ path: 'test-results/tabs-screenshot.png', fullPage: true })
})

test('frontmatter hidden from editor view', async ({ page }) => {
  await page.goto('/')
  await page.waitForTimeout(500)

  // Click a note that has frontmatter
  await page.click('.note-list__item')
  await page.waitForTimeout(500)

  // Frontmatter should be hidden — editor starts with content, not ---
  await page.screenshot({ path: 'test-results/frontmatter-hidden.png', fullPage: true })
})

test('wikilinks: rendered as styled elements and clickable', async ({ page }) => {
  await page.goto('/')
  await page.waitForTimeout(500)

  // Open "Manage Sponsorships" which contains [[Matteo Cellini]] wikilink
  await page.locator('.note-list__item', { hasText: 'Manage Sponsorships' }).click()
  await page.waitForTimeout(500)

  // Screenshot showing wikilink rendered as styled text
  await page.screenshot({ path: 'test-results/wikilinks-styled.png', fullPage: true })

  // Click the wikilink to navigate — use mouse.click to fire real mousedown
  const wikilink = page.locator('.cm-wikilink', { hasText: 'Matteo Cellini' })
  const box = await wikilink.boundingBox()
  if (box) {
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await page.waitForTimeout(500)
    // Should now have a new tab for Matteo Cellini
    await page.screenshot({ path: 'test-results/wikilinks-navigated.png', fullPage: true })
  }
})
