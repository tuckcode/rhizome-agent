import { test, expect } from '@playwright/test'

test('zero-shift detail: focused editor screenshots', async ({ page }) => {
  await page.goto('http://localhost:5173')
  await page.waitForTimeout(800)

  // Open "Build Laputa App" which has headings and bullets
  const noteItem = page.locator('.note-list__item', { hasText: 'Build Laputa App' })
  await noteItem.click()
  await page.waitForTimeout(800)

  const cmEditor = page.locator('.cm-editor')
  await expect(cmEditor).toBeVisible()

  // Screenshot just the editor content area
  const editorBox = await cmEditor.boundingBox()
  if (!editorBox) throw new Error('Editor not visible')

  // Crop to top portion of editor where headings and bullets are
  const clip = {
    x: editorBox.x,
    y: editorBox.y,
    width: editorBox.width,
    height: Math.min(editorBox.height, 500),
  }

  // 1. Initial preview state (cursor not on headings/bullets)
  await page.screenshot({ path: 'test-results/detail-01-preview.png', clip })

  // 2. Click on "Overview" heading
  const headingSpan = page.locator('.cm-header-2', { hasText: 'Overview' }).first()
  const hBox = await headingSpan.boundingBox()
  if (hBox) {
    await page.mouse.click(hBox.x + hBox.width / 2, hBox.y + hBox.height / 2)
    await page.waitForTimeout(500)
  }
  await page.screenshot({ path: 'test-results/detail-02-heading-active.png', clip })

  // 3. Click on a bullet line
  const bulletLine = page.locator('.cm-line', { hasText: 'Four-panel layout working' }).first()
  const bBox = await bulletLine.boundingBox()
  if (bBox) {
    await page.mouse.click(bBox.x + bBox.width / 2, bBox.y + bBox.height / 2)
    await page.waitForTimeout(500)
  }
  await page.screenshot({ path: 'test-results/detail-03-bullet-active.png', clip })

  // 4. Click on plain paragraph to go back to preview
  const para = page.locator('.cm-line', { hasText: 'Custom desktop app' }).first()
  const pBox = await para.boundingBox()
  if (pBox) {
    await page.mouse.click(pBox.x + 10, pBox.y + pBox.height / 2)
    await page.waitForTimeout(500)
  }
  await page.screenshot({ path: 'test-results/detail-04-back-preview.png', clip })

  // 5. Check that heading marker (.cm-formatting-block inside .cm-heading-line) is position:absolute
  const headingMarkers = page.locator('.cm-heading-line .cm-formatting-block')
  const markerCount = await headingMarkers.count()
  console.log(`Heading markers found: ${markerCount}`)

  if (markerCount > 0) {
    const position = await headingMarkers.first().evaluate(el =>
      window.getComputedStyle(el).position
    )
    console.log(`Heading marker position: ${position}`)
    expect(position).toBe('absolute')
  }

  // 6. Check that non-heading markers always have font-size != 0.01em
  const bulletMarkers = page.locator('.cm-line:not(.cm-heading-line) .cm-formatting-block')
  const bmCount = await bulletMarkers.count()
  console.log(`Non-heading block markers found: ${bmCount}`)

  if (bmCount > 0) {
    const fontSize = await bulletMarkers.first().evaluate(el =>
      window.getComputedStyle(el).fontSize
    )
    console.log(`Bullet marker font-size: ${fontSize}`)
    // Should NOT be tiny (library default is 0.01em ≈ 0.15px)
    expect(parseFloat(fontSize)).toBeGreaterThan(10)
  }
})
