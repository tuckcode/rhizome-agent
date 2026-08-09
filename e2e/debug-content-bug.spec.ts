import { test, expect } from '@playwright/test'

test.use({ baseURL: 'http://localhost:5201' })

/**
 * Regression test: editor content must appear after clicking a note.
 *
 * Root cause: BlockNote's replaceBlocks/insertBlocks internally calls flushSync,
 * which fails silently when invoked from inside React's useEffect lifecycle.
 * Fix: defer the content swap via queueMicrotask.
 */
test('editor content appears on first note click', async ({ page }) => {
  const errors: string[] = []
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text())
  })

  await page.goto('/')
  // Wait for note list to load
  await page.waitForSelector('.app__note-list .cursor-pointer', { timeout: 15000 })
  await page.waitForTimeout(200)

  // Click the first note in the note list
  const noteList = page.locator('.app__note-list')
  const firstNote = noteList.locator('.cursor-pointer').first()
  await firstNote.click()

  // Wait for ProseMirror editor to have content
  const pm = page.locator('.ProseMirror')
  await expect(async () => {
    const text = await pm.textContent()
    expect(text?.trim().length, 'Editor content should not be empty').toBeGreaterThan(5)
  }).toPass({ timeout: 5000 })

  // Verify no flushSync errors appeared
  const flushSyncErrors = errors.filter(e => e.includes('flushSync'))
  expect(flushSyncErrors, 'No flushSync-inside-lifecycle errors should occur').toHaveLength(0)
})
