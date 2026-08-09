import { test, expect } from '@playwright/test'

test('closeup: heading marker in gutter', async ({ page }) => {
  await page.goto('http://localhost:5173')
  await page.waitForTimeout(800)

  const noteItem = page.locator('.note-list__item', { hasText: 'Build Laputa App' })
  await noteItem.click()
  await page.waitForTimeout(800)

  // Find "Overview" heading and take a tight crop around it
  const heading = page.locator('.cm-header-2', { hasText: 'Overview' }).first()
  await expect(heading).toBeVisible()
  const hBox = await heading.boundingBox()
  if (!hBox) throw new Error('heading not found')

  // Crop: include gutter area to the left (extra 80px) and a small vertical band
  const clip = {
    x: Math.max(0, hBox.x - 80),
    y: hBox.y - 10,
    width: hBox.width + 120,
    height: hBox.height + 20,
  }

  // Before click — preview mode, no marker visible
  await page.screenshot({ path: 'test-results/closeup-heading-inactive.png', clip })

  // Click on heading to activate
  await page.mouse.click(hBox.x + hBox.width / 2, hBox.y + hBox.height / 2)
  await page.waitForTimeout(500)

  // After click — ## marker should appear in gutter
  await page.screenshot({ path: 'test-results/closeup-heading-active.png', clip })

  // Verify the marker is visible (opacity > 0)
  const marker = page.locator('.cm-heading-line .cm-formatting-block.cm-formatting-block-visible').first()
  if (await marker.count() > 0) {
    const opacity = await marker.evaluate(el => window.getComputedStyle(el).opacity)
    console.log(`Heading marker opacity when active: ${opacity}`)
    expect(parseFloat(opacity)).toBeGreaterThan(0)

    const mBox = await marker.boundingBox()
    console.log(`Heading marker bounding box: ${JSON.stringify(mBox)}`)

    // The marker should be to the LEFT of the heading text
    if (mBox && hBox) {
      console.log(`Marker right edge: ${mBox.x + mBox.width}, Heading left edge: ${hBox.x}`)
      expect(mBox.x + mBox.width).toBeLessThanOrEqual(hBox.x + 5) // marker is left of heading
    }
  }

  // Now check bullet closeup
  const bulletLine = page.locator('.cm-line', { hasText: 'Four-panel layout working' }).first()
  const bBox = await bulletLine.boundingBox()
  if (!bBox) throw new Error('bullet not found')

  // First click elsewhere to deactivate
  await page.mouse.click(hBox.x + 10, hBox.y - 40)
  await page.waitForTimeout(300)

  const bulletClip = {
    x: Math.max(0, bBox.x - 20),
    y: bBox.y - 5,
    width: Math.min(400, bBox.width + 40),
    height: bBox.height + 60, // include next line too
  }

  // Inactive bullets
  await page.screenshot({ path: 'test-results/closeup-bullet-inactive.png', clip: bulletClip })

  // Click on bullet line
  await page.mouse.click(bBox.x + bBox.width / 2, bBox.y + bBox.height / 2)
  await page.waitForTimeout(500)

  // Active bullet
  await page.screenshot({ path: 'test-results/closeup-bullet-active.png', clip: bulletClip })
})
