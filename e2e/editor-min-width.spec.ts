import { test, expect } from '@playwright/test'

test('editor panel has proper width regardless of title length', async ({ page }) => {
  await page.goto('http://localhost:5204')
  await page.waitForTimeout(1000)

  // Click on a note with a short title from the note list
  const noteItems = page.locator('.note-list__item')
  const count = await noteItems.count()

  if (count > 0) {
    // Click the first note
    await noteItems.first().click()
    await page.waitForTimeout(500)

    // Measure editor container width
    const editorContainer = page.locator('.editor__blocknote-container')
    const box = await editorContainer.boundingBox()

    // The editor should have a reasonable width (at least 300px)
    expect(box).toBeTruthy()
    expect(box!.width).toBeGreaterThan(300)

    // Screenshot for visual verification
    await page.screenshot({ path: 'test-results/editor-min-width.png', fullPage: true })

    // Also check that .bn-container fills the editor width
    const bnContainer = page.locator('.editor__blocknote-container .bn-container')
    const bnBox = await bnContainer.boundingBox()
    expect(bnBox).toBeTruthy()
    expect(bnBox!.width).toBeGreaterThan(300)
  }
})
