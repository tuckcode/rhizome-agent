import { test, expect } from '@playwright/test'

test('zero horizontal shift: headings and bullets', async ({ page }) => {
  await page.goto('http://localhost:5173')
  await page.waitForTimeout(800)

  // Open "Build Laputa App" which has headings and bullets
  const noteItem = page.locator('.note-list__item', { hasText: 'Build Laputa App' })
  await noteItem.click()
  await page.waitForTimeout(800)

  const cmEditor = page.locator('.cm-editor')
  await expect(cmEditor).toBeVisible()

  // Screenshot 1: initial state — cursor after frontmatter, headings/bullets in preview mode
  await page.screenshot({ path: 'test-results/zero-shift-01-initial.png', fullPage: true })

  // Find a heading line (## Overview) and measure its text position
  const headingText = page.locator('.cm-header-2', { hasText: 'Overview' }).first()
  await expect(headingText).toBeVisible()

  // Get bounding box BEFORE clicking on it (inactive state)
  const beforeBox = await headingText.boundingBox()
  console.log('Heading "Overview" BEFORE click:', JSON.stringify(beforeBox))

  // Screenshot 2: before clicking heading
  await page.screenshot({ path: 'test-results/zero-shift-02-before-heading-click.png', fullPage: true })

  // Click on the heading to activate it
  if (beforeBox) {
    await page.mouse.click(beforeBox.x + beforeBox.width / 2, beforeBox.y + beforeBox.height / 2)
  }
  await page.waitForTimeout(500)

  // Screenshot 3: after clicking heading — ## should appear in gutter, text stays put
  await page.screenshot({ path: 'test-results/zero-shift-03-after-heading-click.png', fullPage: true })

  // Get bounding box AFTER clicking (active state)
  const afterBox = await headingText.boundingBox()
  console.log('Heading "Overview" AFTER click:', JSON.stringify(afterBox))

  // CRITICAL: The heading text X position must not change
  if (beforeBox && afterBox) {
    const xShift = Math.abs(afterBox.x - beforeBox.x)
    console.log(`Horizontal shift: ${xShift}px`)
    expect(xShift).toBeLessThan(2) // Allow 1px tolerance for subpixel rendering
  }

  // Now test bullet lines: click on a bullet item
  const bulletText = page.locator('.cm-line', { hasText: 'Four-panel layout working' }).first()
  await expect(bulletText).toBeVisible()

  const bulletBeforeBox = await bulletText.boundingBox()
  console.log('Bullet line BEFORE click:', JSON.stringify(bulletBeforeBox))

  // Screenshot 4: before clicking bullet
  await page.screenshot({ path: 'test-results/zero-shift-04-before-bullet-click.png', fullPage: true })

  // Click on the bullet line
  if (bulletBeforeBox) {
    await page.mouse.click(bulletBeforeBox.x + bulletBeforeBox.width / 2, bulletBeforeBox.y + bulletBeforeBox.height / 2)
  }
  await page.waitForTimeout(500)

  // Screenshot 5: after clicking bullet
  await page.screenshot({ path: 'test-results/zero-shift-05-after-bullet-click.png', fullPage: true })

  const bulletAfterBox = await bulletText.boundingBox()
  console.log('Bullet line AFTER click:', JSON.stringify(bulletAfterBox))

  // CRITICAL: Bullet line X position must not change
  if (bulletBeforeBox && bulletAfterBox) {
    const xShift = Math.abs(bulletAfterBox.x - bulletBeforeBox.x)
    console.log(`Bullet horizontal shift: ${xShift}px`)
    expect(xShift).toBeLessThan(2)
  }

  // Screenshot 6: click somewhere else (a plain paragraph) to verify heading/bullets go back to preview
  const paragraph = page.locator('.cm-line', { hasText: 'Custom desktop app' }).first()
  if (await paragraph.isVisible()) {
    const paraBox = await paragraph.boundingBox()
    if (paraBox) {
      await page.mouse.click(paraBox.x + 10, paraBox.y + paraBox.height / 2)
    }
    await page.waitForTimeout(500)
  }
  await page.screenshot({ path: 'test-results/zero-shift-06-back-to-preview.png', fullPage: true })

  // Verify heading underline is removed (FIX 1)
  const headingLine = page.locator('.cm-heading-line').first()
  if (await headingLine.count() > 0) {
    const borderBottom = await headingLine.evaluate(el =>
      window.getComputedStyle(el).borderBottom
    )
    console.log(`Heading line border-bottom: ${borderBottom}`)
    expect(borderBottom).toContain('none')
  }
})
