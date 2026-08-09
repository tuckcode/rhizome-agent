import fs from 'fs'
import path from 'path'
import { test, expect, type Page } from '@playwright/test'
import { createFixtureVaultCopy, openFixtureVault, removeFixtureVaultCopy } from '../helpers/fixtureVault'
import { executeCommand, openCommandPalette } from './helpers'

let tempVaultDir: string

test.beforeEach(async ({ page }, testInfo) => {
  testInfo.setTimeout(60_000)
  tempVaultDir = createFixtureVaultCopy()
  await openFixtureVault(page, tempVaultDir)
})

test.afterEach(async () => {
  removeFixtureVaultCopy(tempVaultDir)
})

async function openNote(page: Page, title: string) {
  const noteList = page.locator('[data-testid="note-list-container"]')
  await noteList.getByText(title, { exact: true }).click()
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

test('@smoke Cmd+S preserves the existing filename until the explicit breadcrumb sync action', async ({ page }) => {
  const syncedPath = path.join(tempVaultDir, 'note', 'breadcrumb-sync-target.md')
  const manuallyRenamedPath = path.join(tempVaultDir, 'note', 'manual-breadcrumb-name.md')
  const originalPath = path.join(tempVaultDir, 'note', 'note-b.md')
  const updatedTitle = 'Breadcrumb Sync Target'

  await openNote(page, 'Note B')
  await openRawMode(page)

  const rawContent = await getRawEditorContent(page)
  expect(rawContent).toContain('# Note B')

  await setRawEditorContent(page, rawContent.replace('# Note B', `# ${updatedTitle}`))
  await page.keyboard.press('Meta+s')
  await openBlockNoteMode(page)

  await expect(page.getByRole('heading', { name: updatedTitle, level: 1 })).toBeVisible({ timeout: 5_000 })
  await expect(page.getByTestId('breadcrumb-filename-trigger')).toContainText('note-b')
  await expect(page.getByTestId('breadcrumb-sync-button')).toBeVisible()

  await page.getByTestId('breadcrumb-sync-button').click()
  await expect(page.locator('.fixed.bottom-8')).toContainText('Renamed', { timeout: 5_000 })
  await expect(page.getByTestId('breadcrumb-filename-trigger')).toContainText('breadcrumb-sync-target')
  await expect(page.getByTestId('breadcrumb-sync-button')).toHaveCount(0)

  await expect.poll(() => fs.existsSync(originalPath)).toBe(false)
  await expect.poll(() => fs.existsSync(syncedPath)).toBe(true)

  await page.getByTestId('breadcrumb-filename-trigger').focus()
  await page.keyboard.press('Enter')
  const firstInput = page.getByTestId('breadcrumb-filename-input')
  await expect(firstInput).toHaveValue('breadcrumb-sync-target')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('breadcrumb-filename-input')).toHaveCount(0)

  await page.getByTestId('breadcrumb-filename-trigger').dblclick()
  const renameInput = page.getByTestId('breadcrumb-filename-input')
  await renameInput.fill('manual-breadcrumb-name')
  await renameInput.press('Enter')

  await expect(page.locator('.fixed.bottom-8')).toContainText('Renamed', { timeout: 5_000 })
  await expect(page.getByTestId('breadcrumb-filename-trigger')).toContainText('manual-breadcrumb-name')
  await expect.poll(() => fs.existsSync(syncedPath)).toBe(false)
  await expect.poll(() => fs.existsSync(manuallyRenamedPath)).toBe(true)

  await openRawMode(page)
  await expect.poll(async () => getRawEditorContent(page)).toContain(`# ${updatedTitle}`)
})
