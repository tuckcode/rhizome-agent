import { test, expect, type Locator, type Page } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import {
  createFixtureVaultCopy,
  openFixtureVaultDesktopHarness,
  removeFixtureVaultCopy,
} from '../helpers/fixtureVault'
import { triggerMenuCommand } from './testBridge'

let tempVaultDir: string

type LinkErrorMessage = { message: string }
type OpenedUrlExpectation = { url: string; count: number }
type InlineUrlNoteFile = { filePath: string }

async function openNote(page: Page, title: string) {
  const noteList = page.locator('[data-testid="note-list-container"]')
  await noteList.getByText(title, { exact: true }).click()
}

async function expectActiveHeading(page: Page, title: string) {
  await expect(page.locator('.bn-editor h1').first()).toHaveText(title, { timeout: 5_000 })
}

function isStaleLinkClickError({ message }: LinkErrorMessage): boolean {
  return (
    message.includes('dispatchEvent') ||
    message.includes('nodeDOM') ||
    message.includes('view is not available')
  )
}

function trackStaleLinkClickErrors(page: Page): string[] {
  const messages: string[] = []
  page.on('pageerror', (error) => {
    if (isStaleLinkClickError({ message: error.message })) messages.push(error.message)
  })
  page.on('console', (message) => {
    if (message.type() === 'error' && isStaleLinkClickError({ message: message.text() })) {
      messages.push(message.text())
    }
  })
  return messages
}

async function appendToProjectParagraph(page: Page, marker: string): Promise<void> {
  const paragraph = page.locator('.bn-editor p')
    .filter({ hasText: 'This is a test project that references other notes.' })
    .first()
  await expect(paragraph).toBeVisible({ timeout: 5_000 })

  const box = await paragraph.boundingBox()
  if (!box) throw new Error('Expected editable paragraph bounds')
  await paragraph.click({
    position: {
      x: Math.max(1, box.width - 2),
      y: Math.max(1, box.height / 2),
    },
  })
  await page.keyboard.press('End')
  await page.keyboard.type(` ${marker}`)
}

async function expectFileToContain(filePath: string, marker: string): Promise<void> {
  await expect.poll(() => fs.readFileSync(filePath, 'utf8'), { timeout: 10_000 }).toContain(marker)
}

async function reloadVault(page: Page): Promise<void> {
  await triggerMenuCommand(page, 'vault-reload')
  await expect(page.getByText(/Vault reloaded \(\d+ entries\)/).last()).toBeVisible({
    timeout: 5_000,
  })
}

async function stubExternalLinkOpens(page: Page): Promise<void> {
  await page.evaluate(() => {
    const testWindow = window as typeof window & {
      __openedEditorUrls?: string[]
      isTauri?: boolean
      open: typeof window.open
    }
    testWindow.isTauri = false
    testWindow.__openedEditorUrls = []
    testWindow.open = ((url: string | URL | undefined) => {
      if (url) testWindow.__openedEditorUrls?.push(String(url))
      return null
    }) as typeof window.open
  })
}

async function expectOpenedUrlCount(page: Page, expectation: OpenedUrlExpectation): Promise<void> {
  await expect.poll(
    () => page.evaluate(() => {
      const testWindow = window as typeof window & { __openedEditorUrls?: string[] }
      return testWindow.__openedEditorUrls ?? []
    }),
    { timeout: 5_000 },
  ).toHaveLength(expectation.count)
  await expect.poll(
    () => page.evaluate((expectedUrl) => {
      const testWindow = window as typeof window & { __openedEditorUrls?: string[] }
      return (testWindow.__openedEditorUrls ?? []).filter(url => url === expectedUrl).length
    }, expectation.url),
    { timeout: 5_000 },
  ).toBe(expectation.count)
}

async function dispatchModifiedLinkActivation(link: Locator): Promise<void> {
  await link.evaluate((element) => {
    const target = element.firstChild ?? element
    target.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      metaKey: true,
    }))
    target.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      metaKey: true,
    }))
  })
}

function writeInlineUrlNote({ filePath }: InlineUrlNoteFile): void {
  fs.writeFileSync(filePath, `---
Is A: Note
Status: Active
---

# Inline Link Reload

Use [regular link](https://example.com) beside [[Note B]] after reload.
`, 'utf8')
}

test.beforeEach(async ({ page }, testInfo) => {
  testInfo.setTimeout(60_000)
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  tempVaultDir = createFixtureVaultCopy()
  await openFixtureVaultDesktopHarness(page, tempVaultDir)
})

test.afterEach(() => {
  removeFixtureVaultCopy(tempVaultDir)
})

test('@smoke Cmd-clicking an existing wikilink preserves Back/Forward history', async ({ page }) => {
  await openNote(page, 'Alpha Project')
  await expectActiveHeading(page, 'Alpha Project')

  const wikilink = page.locator('.bn-editor .wikilink').filter({ hasText: 'Note B' }).first()
  await expect(wikilink).toBeVisible()

  await wikilink.click({ modifiers: ['Meta'] })
  await expectActiveHeading(page, 'Note B')

  await page.keyboard.press('Meta+ArrowLeft')
  await expectActiveHeading(page, 'Alpha Project')

  await page.keyboard.press('Meta+ArrowRight')
  await expectActiveHeading(page, 'Note B')

  await openNote(page, 'Note C')
  await expectActiveHeading(page, 'Note C')

  await page.keyboard.press('Meta+ArrowLeft')
  await expectActiveHeading(page, 'Note B')
})

test('Cmd-clicking a wikilink after rich-edit autosave does not dispatch through stale link nodes', async ({ page }) => {
  const staleClickErrors = trackStaleLinkClickErrors(page)
  const marker = `autosaved wikilink click ${Date.now()}`
  const alphaPath = path.join(tempVaultDir, 'project', 'alpha-project.md')

  await openNote(page, 'Alpha Project')
  await expectActiveHeading(page, 'Alpha Project')

  await appendToProjectParagraph(page, marker)
  await expectFileToContain(alphaPath, marker)

  const wikilink = page.locator('.bn-editor .wikilink').filter({ hasText: 'Note B' }).first()
  await expect(wikilink).toBeVisible()

  await wikilink.click()
  await expectActiveHeading(page, 'Alpha Project')
  expect(staleClickErrors).toEqual([])

  await wikilink.click({ modifiers: ['Meta'] })
  await expectActiveHeading(page, 'Note B')
  expect(staleClickErrors).toEqual([])
})

test('Cmd-clicking an inline URL after a vault reload does not dispatch through stale link nodes', async ({ page }) => {
  const staleClickErrors = trackStaleLinkClickErrors(page)
  const notePath = path.join(tempVaultDir, 'note', 'inline-link-reload.md')

  writeInlineUrlNote({ filePath: notePath })
  await reloadVault(page)
  await openNote(page, 'Inline Link Reload')
  await expectActiveHeading(page, 'Inline Link Reload')
  await stubExternalLinkOpens(page)

  const inlineUrl = page.locator('.bn-editor a[href="https://example.com"]').first()
  await expect(inlineUrl).toBeVisible({ timeout: 5_000 })

  await dispatchModifiedLinkActivation(inlineUrl)
  await expectOpenedUrlCount(page, { url: 'https://example.com', count: 1 })
  expect(staleClickErrors).toEqual([])

  await reloadVault(page)
  await expect(page.locator('.bn-editor')).toContainText('regular link')

  await dispatchModifiedLinkActivation(inlineUrl)
  await expectOpenedUrlCount(page, { url: 'https://example.com', count: 2 })
  expect(staleClickErrors).toEqual([])
})
