import { test, expect, type Page } from '@playwright/test'
import { openCommandPalette, executeCommand } from './helpers'

/**
 * Smoke test: editing in raw (CodeMirror) mode and switching back to
 * BlockNote must show the updated content — the two editors stay in sync.
 */

async function openFirstNote(page: Page) {
  const noteList = page.locator('[data-testid="note-list-container"]')
  await noteList.waitFor({ timeout: 5000 })
  await noteList.locator('.cursor-pointer').first().click()
  await expect(page.locator('.bn-editor')).toBeVisible({ timeout: 5000 })
}

async function openRawMode(page: Page) {
  await openCommandPalette(page)
  await executeCommand(page, 'Toggle Raw')
  await expect(page.locator('.cm-content')).toBeVisible({ timeout: 5_000 })
}

async function openBlockNoteMode(page: Page) {
  await openCommandPalette(page)
  await executeCommand(page, 'Toggle Raw')
  await expect(page.locator('.bn-editor')).toBeVisible({ timeout: 5_000 })
}

/** Get the full text content from the CodeMirror raw editor. */
async function getRawEditorContent(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.querySelector('.cm-content')
    if (!el) return ''
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const view = (el as any).cmTile?.view
    if (view) return view.state.doc.toString() as string
    return el.textContent ?? ''
  })
}

/** Replace the entire raw editor content via CodeMirror dispatch (reliable). */
async function setRawEditorContent(page: Page, content: string) {
  await page.evaluate((newContent) => {
    const el = document.querySelector('.cm-content')
    if (!el) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const view = (el as any).cmTile?.view
    if (!view) return
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: newContent },
    })
  }, content)
}

test.describe('Raw editor ↔ BlockNote sync', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('editing in raw mode and switching to BlockNote shows updated content', async ({ page }) => {
    await openFirstNote(page)

    // Toggle to raw mode
    await openRawMode(page)

    // Append unique text in raw mode, then verify it appears in BlockNote.
    const rawContent = await getRawEditorContent(page)
    expect(rawContent).toBeTruthy()
    const appendedText = `Raw editor sync ${Date.now()}`
    const updatedContent = `${rawContent}\n\n${appendedText}`
    await setRawEditorContent(page, updatedContent)
    await page.waitForTimeout(600) // Wait for debounce (500ms)

    // Toggle back to BlockNote
    await openBlockNoteMode(page)

    // Verify the BlockNote editor shows the appended text.
    await expect(page.locator('.bn-editor')).toContainText(appendedText, { timeout: 5000 })
  })

  test('switching BlockNote → raw → BlockNote multiple times preserves content', async ({ page }) => {
    await openFirstNote(page)

    // Cycle 1: toggle to raw, edit, toggle back
    await openRawMode(page)

    const rawContent1 = await getRawEditorContent(page)
    const cycleOneText = `Cycle one ${Date.now()}`
    const edit1 = `${rawContent1}\n\n${cycleOneText}`
    await setRawEditorContent(page, edit1)
    await page.waitForTimeout(600)

    await openBlockNoteMode(page)

    await expect(page.locator('.bn-editor')).toContainText(cycleOneText, { timeout: 5000 })

    // Cycle 2: toggle to raw again, verify content persisted, edit again
    await openRawMode(page)

    const rawContent2 = await getRawEditorContent(page)
    expect(rawContent2).toContain(cycleOneText)

    const cycleTwoText = `Cycle two ${Date.now()}`
    const edit2 = `${rawContent2}\n\n${cycleTwoText}`
    await setRawEditorContent(page, edit2)
    await page.waitForTimeout(600)

    await openBlockNoteMode(page)

    await expect(page.locator('.bn-editor')).toContainText(cycleOneText, { timeout: 5000 })
    await expect(page.locator('.bn-editor')).toContainText(cycleTwoText, { timeout: 5000 })
  })

  test('appended text in raw mode appears in BlockNote after switch', async ({ page }) => {
    await openFirstNote(page)

    // Toggle to raw and append text via CodeMirror dispatch
    await openRawMode(page)
    await expect(page.locator('.cm-content')).toBeVisible()

    const content = await getRawEditorContent(page)
    await setRawEditorContent(page, content + '\n\nAppended by raw editor test')
    await page.waitForTimeout(600) // Wait for debounce

    // Toggle back to BlockNote
    await openBlockNoteMode(page)
    await expect(page.locator('.bn-editor')).toBeVisible({ timeout: 5000 })
    await page.waitForTimeout(500)

    // Verify the appended text shows up in BlockNote
    await expect(page.locator('.bn-editor')).toContainText('Appended by raw editor test', { timeout: 5000 })
  })
})
