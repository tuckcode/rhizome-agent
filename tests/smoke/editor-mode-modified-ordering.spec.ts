import fs from 'fs'
import path from 'path'
import { test, expect, type Page } from '@playwright/test'
import {
  createFixtureVaultCopy,
  openFixtureVaultDesktopHarness,
  removeFixtureVaultCopy,
} from '../helpers/fixtureVault'

const RAW_EDITOR = '[data-testid="raw-editor-codemirror"]'
const LIST_ROWS = '[data-testid="note-list-container"] [data-note-path]'
const SORT_BUTTON = '[data-testid="sort-button-__list__"]'
const SORT_OPTION_MODIFIED = '[data-testid="sort-option-modified"]'
const SORT_DIRECTION_DESC = '[data-testid="sort-dir-desc-modified"]'

let tempVaultDir: string
let alphaPath: string
let newerPath: string

function setAllMarkdownModifiedTimes(rootDir: string, timestamp: Date) {
  const stack = [rootDir]

  while (stack.length > 0) {
    const current = stack.pop()
    if (!current) continue

    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const nextPath = path.join(current, entry.name)
      if (entry.isDirectory()) {
        stack.push(nextPath)
        continue
      }
      if (entry.isFile() && nextPath.endsWith('.md')) {
        fs.utimesSync(nextPath, timestamp, timestamp)
      }
    }
  }
}

async function sortListByModifiedDesc(page: Page) {
  await page.locator(SORT_BUTTON).click()
  await page.locator(SORT_OPTION_MODIFIED).click()
  await page.locator(SORT_BUTTON).click()
  await page.locator(SORT_DIRECTION_DESC).click()
}

async function listOrder(page: Page): Promise<string[]> {
  return page.locator(LIST_ROWS).evaluateAll((rows) =>
    rows
      .map((row) => row.getAttribute('data-note-path'))
      .filter((value): value is string => typeof value === 'string' && value.length > 0),
  )
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
  await page.evaluate((nextContent) => {
    const el = document.querySelector('.cm-content')
    if (!el) {
      throw new Error('CodeMirror content element is missing')
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const view = (el as any).cmTile?.view
    if (!view) {
      throw new Error('CodeMirror view is missing')
    }
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: nextContent },
    })
  }, content)
}

async function installSaveTracker(page: Page) {
  await page.evaluate(() => {
    const internals = window.__TAURI_INTERNALS__
    if (!internals || typeof internals.invoke !== 'function') {
      throw new Error('Tauri invoke bridge is missing')
    }

    if (window.__rhizomeTest?.getTrackedSaveCount) {
      window.__rhizomeTest.resetTrackedSaveCount?.()
      return
    }

    let trackedSaveCount = 0
    const originalInvoke = internals.invoke.bind(internals)

    internals.invoke = async (command: string, args?: Record<string, unknown>) => {
      if (command === 'save_note_content') {
        trackedSaveCount += 1
      }
      return originalInvoke(command, args)
    }

    window.__rhizomeTest = {
      ...window.__rhizomeTest,
      getTrackedSaveCount: () => trackedSaveCount,
      resetTrackedSaveCount: () => {
        trackedSaveCount = 0
      },
    }
  })
}

async function trackedSaveCount(page: Page): Promise<number> {
  return page.evaluate(() => window.__rhizomeTest?.getTrackedSaveCount?.() ?? 0)
}

async function resetTrackedSaveCount(page: Page) {
  await page.evaluate(() => {
    window.__rhizomeTest?.resetTrackedSaveCount?.()
  })
}

test.describe('editor mode modified-date ordering', () => {
  test.beforeEach(async ({ page }) => {
    tempVaultDir = createFixtureVaultCopy()
    alphaPath = path.join(tempVaultDir, 'project/alpha-project.md')
    newerPath = path.join(tempVaultDir, 'note/note-b.md')

    setAllMarkdownModifiedTimes(tempVaultDir, new Date('2026-01-01T10:00:00Z'))
    fs.utimesSync(newerPath, new Date('2026-01-01T12:00:00Z'), new Date('2026-01-01T12:00:00Z'))

    await openFixtureVaultDesktopHarness(page, tempVaultDir)
    await installSaveTracker(page)
    await sortListByModifiedDesc(page)
    await expect(page.locator(`[data-note-path="${alphaPath}"]`)).toBeVisible({ timeout: 5_000 })
  })

  test.afterEach(() => {
    removeFixtureVaultCopy(tempVaultDir)
  })

  test('keyboard-only editor toggles do not save or reorder by modified date, but real edits still save', async ({ page }) => {
    const baselineOrder = await listOrder(page)
    const baselineIndex = baselineOrder.indexOf(alphaPath)

    expect(baselineOrder[0]).toBe(newerPath)
    expect(baselineIndex).toBeGreaterThan(0)

    await page.locator(`[data-note-path="${alphaPath}"]`).click()
    await expect(page.locator('.bn-editor')).toBeVisible({ timeout: 5_000 })
    await resetTrackedSaveCount(page)

    const modifiedBeforeToggle = fs.statSync(alphaPath).mtimeMs

    await page.keyboard.press('Control+Backslash')
    await expect(page.locator(RAW_EDITOR)).toBeVisible({ timeout: 5_000 })
    await page.waitForTimeout(700)
    expect(fs.statSync(alphaPath).mtimeMs).toBe(modifiedBeforeToggle)

    await page.keyboard.press('Control+Backslash')
    await expect(page.locator('.bn-editor')).toBeVisible({ timeout: 5_000 })
    await page.waitForTimeout(700)
    expect(fs.statSync(alphaPath).mtimeMs).toBe(modifiedBeforeToggle)

    const orderAfterViewToggle = await listOrder(page)
    expect(orderAfterViewToggle[0]).toBe(newerPath)
    expect(orderAfterViewToggle.indexOf(alphaPath)).toBe(baselineIndex)
    expect(await trackedSaveCount(page)).toBe(0)

    await page.keyboard.press('Control+Backslash')
    await expect(page.locator(RAW_EDITOR)).toBeVisible({ timeout: 5_000 })

    const rawContent = await getRawEditorContent(page)
    const appendedText = `Actual raw edit ${Date.now()}`
    await setRawEditorContent(page, `${rawContent}\n\n${appendedText}`)
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+s' : 'Control+s')
    await page.waitForTimeout(300)

    await expect.poll(() => fs.statSync(alphaPath).mtimeMs).toBeGreaterThan(modifiedBeforeToggle)
    await expect.poll(() => trackedSaveCount(page)).toBeGreaterThan(0)

    await page.keyboard.press('Control+Backslash')
    await expect(page.locator('.bn-editor')).toContainText(appendedText, { timeout: 5_000 })
  })
})
