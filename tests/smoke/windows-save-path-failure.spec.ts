import { test, expect, type Page } from '@playwright/test'
import { executeCommand, openCommandPalette, sendShortcut } from './helpers'
import {
  createFixtureVaultCopy,
  openAllNotesList,
  openFixtureVaultDesktopHarness,
  removeFixtureVaultCopy,
} from '../helpers/fixtureVault'

const RAW_EDITOR = '.cm-content'

type MockHandler = (args?: Record<string, unknown>) => unknown

async function openFirstNote(page: Page) {
  const noteList = await openAllNotesList(page)
  await noteList.locator('.cursor-pointer').first().click()
  await expect(page.locator('.bn-editor')).toBeVisible({ timeout: 5_000 })
}

async function setRawEditorContent(page: Page, content: string) {
  await page.evaluate((nextContent) => {
    const el = document.querySelector('.cm-content')
    if (!el) throw new Error('CodeMirror content element is missing')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const view = (el as any).cmTile?.view
    if (!view) throw new Error('CodeMirror view is missing')
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: nextContent },
    })
    view.focus()
  }, content)
}

async function openRawMode(page: Page) {
  await openCommandPalette(page)
  await executeCommand(page, 'Toggle Raw')
  await expect(page.locator(RAW_EDITOR)).toBeVisible({ timeout: 5_000 })
}

/**
 * The fixture vault re-applies its handlers on every read of
 * window.__mockHandlers, so pin the patched object in place.
 */
async function installFailOnceSaveMock(page: Page) {
  await page.waitForFunction(() => Boolean(window.__mockHandlers?.save_note_content))
  await page.evaluate(() => {
    const handlers = window.__mockHandlers as Record<string, MockHandler>
    const originalSaveNoteContent = handlers.save_note_content
    let shouldFail = true
    window.__rhizomeTest = {
      ...window.__rhizomeTest,
      saveAttempts: [],
    }
    handlers.save_note_content = (args?: Record<string, unknown>) => {
      window.__rhizomeTest?.saveAttempts?.push(args)
      if (shouldFail) {
        shouldFail = false
        throw new Error('The filename, directory name, or volume label syntax is incorrect. (os error 123)')
      }
      return originalSaveNoteContent?.(args)
    }
    Object.defineProperty(window, '__mockHandlers', { configurable: true, value: handlers, writable: true })
  })
}

let tempVaultDir: string | null = null

test.afterEach(() => {
  removeFixtureVaultCopy(tempVaultDir)
  tempVaultDir = null
})

// The fixture vault, not the bare mock: every mock note sits outside the
// mock's active vault, so the editor drops edits to them before saving.
test('failed Windows path saves show a recoverable toast and retry the draft', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (err) => { pageErrors.push(err.message) })
  tempVaultDir = createFixtureVaultCopy()
  await openFixtureVaultDesktopHarness(page, tempVaultDir)
  await openFirstNote(page)
  await installFailOnceSaveMock(page)

  await openRawMode(page)
  await setRawEditorContent(page, '# Retryable Windows Save\n\nDraft that must survive failure')
  await page.waitForTimeout(550)

  await sendShortcut(page, 's', ['Control'])
  await expect(page.locator('.fixed.bottom-8')).toContainText('note path is invalid on this platform', { timeout: 5_000 })
  expect(pageErrors.filter((message) => message.includes('os error 123'))).toHaveLength(0)

  await sendShortcut(page, 's', ['Control'])
  await expect(page.locator('.fixed.bottom-8')).toContainText('Saved', { timeout: 5_000 })

  const saveAttempts = await page.evaluate(() => window.__rhizomeTest?.saveAttempts ?? [])
  expect(saveAttempts).toHaveLength(2)
  expect(saveAttempts[1]).toEqual(expect.objectContaining({
    content: '# Retryable Windows Save\n\nDraft that must survive failure',
  }))
})
