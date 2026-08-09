import { test, expect } from '@playwright/test'

test.use({ baseURL: 'http://localhost:5239' })

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.waitForTimeout(2000) // Wait for vault data to load
})

test('editor loads and renders note content for editing', async ({ page }) => {
  await page.screenshot({ path: 'test-results/save-01-initial.png', fullPage: true })

  // 1. Click a note in the note list panel
  const noteList = page.locator('.app__note-list')
  await expect(noteList).toBeVisible({ timeout: 5000 })
  const firstNote = noteList.locator('div.cursor-pointer').first()
  await expect(firstNote).toBeVisible({ timeout: 5000 })
  await firstNote.click()
  await page.waitForTimeout(1000)

  // 2. Verify the BlockNote editor is visible with content
  const editor = page.locator('.bn-editor')
  await expect(editor).toBeVisible({ timeout: 5000 })

  // Verify the editor is contenteditable (ready for editing)
  const isEditable = await editor.getAttribute('contenteditable')
  expect(isEditable).toBe('true')

  await page.screenshot({ path: 'test-results/save-02-note-open.png', fullPage: true })

  // 3. Verify the editor has content (not empty)
  const editorText = await page.evaluate(() => {
    const el = document.querySelector('.bn-editor')
    return el?.textContent ?? ''
  })
  expect(editorText.length).toBeGreaterThan(10)

  // 4. Verify tab bar shows the active note
  const tabBar = page.locator('.editor')
  await expect(tabBar).toBeVisible()

  await page.screenshot({ path: 'test-results/save-03-editor-ready.png', fullPage: true })
})

test('Cmd+S keyboard shortcut triggers save toast', async ({ page }) => {
  // Open a note
  const noteList = page.locator('.app__note-list')
  await expect(noteList).toBeVisible({ timeout: 5000 })
  const firstNote = noteList.locator('div.cursor-pointer').first()
  await firstNote.click()
  await page.waitForTimeout(1000)

  // Press Cmd+S — shows either "Saved" or "Nothing to save" depending on
  // whether BlockNote's onChange fired from prior interactions
  await page.keyboard.press('Meta+s')
  await page.waitForTimeout(500)

  // Verify a save-related toast appears (the shortcut was handled)
  const toast = page.locator('text=/Saved|Nothing to save/')
  await expect(toast).toBeVisible({ timeout: 3000 })

  await page.screenshot({ path: 'test-results/save-04-cmd-s.png', fullPage: true })
})
