import { test, expect, type Page } from '@playwright/test'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { APP_COMMAND_IDS } from '../../src/hooks/appCommandCatalog'
import {
  createFixtureVaultCopy,
  openFixtureVaultDesktopHarness,
  removeFixtureVaultCopy,
} from '../helpers/fixtureVault'
import { triggerShortcutCommand } from './testBridge'

const VIEW_RELATIVE_PATH = path.join('views', 'active-projects.yml')
const DUPLICATE_RELATIVE_PATH = path.join('views', 'active-projects.md')
const VIEW_TITLE = 'Active Projects'
const VIEW_CONTENT = `name: Active Projects
icon: rocket
color: blue
sort: "modified:desc"
filters:
  all:
    - field: type
      op: equals
      value: Project
`

let tempVaultDir: string

function seedViewFile(vaultPath: string): void {
  const viewPath = path.join(vaultPath, VIEW_RELATIVE_PATH)
  fs.mkdirSync(path.dirname(viewPath), { recursive: true })
  fs.writeFileSync(viewPath, VIEW_CONTENT)
}

function buildViewEntry(vaultPath: string) {
  const viewPath = path.join(vaultPath, VIEW_RELATIVE_PATH)
  return {
    path: viewPath,
    filename: path.basename(viewPath),
    title: VIEW_TITLE,
    isA: null,
    aliases: [],
    belongsTo: [],
    relatedTo: [],
    status: null,
    archived: false,
    modifiedAt: Date.now(),
    createdAt: null,
    fileSize: Buffer.byteLength(VIEW_CONTENT),
    snippet: '',
    wordCount: 0,
    relationships: {},
    icon: null,
    color: null,
    order: null,
    sidebarLabel: null,
    template: null,
    sort: null,
    view: null,
    visible: null,
    organized: false,
    favorite: false,
    favoriteIndex: null,
    listPropertiesDisplay: [],
    outgoingLinks: [],
    properties: {},
    hasH1: false,
    fileKind: 'text',
  }
}

async function injectViewEntryIntoVaultList(page: Page, vaultPath: string): Promise<void> {
  const viewEntry = buildViewEntry(vaultPath)
  await page.route('**/api/vault/list*', async (route) => {
    const response = await route.fetch()
    const entries = await response.json()
    if (!Array.isArray(entries)) {
      await route.fulfill({ response })
      return
    }

    const hasViewEntry = entries.some((entry) => entry?.path === viewEntry.path)
    const nextEntries = hasViewEntry ? entries : [...entries, viewEntry]
    await route.fulfill({ response, json: nextEntries })
  })
}

async function openQuickOpenEntry(page: Page, title: string): Promise<void> {
  await triggerShortcutCommand(page, APP_COMMAND_IDS.fileQuickOpen)
  const input = page.locator('input[placeholder="Search notes..."]')
  await expect(input).toBeVisible({ timeout: 5_000 })
  await input.fill(title)
  await page.keyboard.press('Enter')
}

async function appendRawEditorLine(page: Page, line: string): Promise<void> {
  await page.evaluate((nextLine) => {
    const host = document.querySelector('.cm-content')
    if (!host) {
      throw new Error('CodeMirror content element is missing')
    }

    type CodeMirrorHost = Element & {
      cmTile?: {
        view?: {
          state: { doc: { toString(): string; length: number } }
          dispatch(transaction: { changes: { from: number; to: number; insert: string } }): void
        }
      }
    }

    const view = (host as CodeMirrorHost).cmTile?.view
    if (!view) {
      throw new Error('CodeMirror view is missing')
    }

    const doc = view.state.doc.toString()
    view.dispatch({
      changes: {
        from: doc.length,
        to: doc.length,
        insert: `\n${nextLine}\n`,
      },
    })
  }, line)
}

async function readRawEditorContent(page: Page): Promise<string> {
  return page.evaluate(() => {
    const host = document.querySelector('.cm-content')
    if (!host) return ''

    type CodeMirrorHost = Element & {
      cmTile?: {
        view?: {
          state: { doc: { toString(): string } }
        }
      }
    }

    return (host as CodeMirrorHost).cmTile?.view?.state.doc.toString() ?? host.textContent ?? ''
  })
}

test.describe('raw .yml view save regression', () => {
  test.beforeEach(() => {
    tempVaultDir = createFixtureVaultCopy()
    seedViewFile(tempVaultDir)
  })

  test.afterEach(() => {
    removeFixtureVaultCopy(tempVaultDir)
  })

  test('saving a raw-edited .yml view preserves the .yml file and blocks the raw toggle shortcut @smoke', async ({ page }) => {
    const viewPath = path.join(tempVaultDir, VIEW_RELATIVE_PATH)
    const duplicatePath = path.join(tempVaultDir, DUPLICATE_RELATIVE_PATH)
    const marker = `# raw-yml-save-${Date.now()}-${os.userInfo().username}`

    await injectViewEntryIntoVaultList(page, tempVaultDir)
    await openFixtureVaultDesktopHarness(page, tempVaultDir)
    await openQuickOpenEntry(page, VIEW_TITLE)

    await expect(page.getByTestId('raw-editor-codemirror')).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('.bn-editor')).toHaveCount(0)

    await triggerShortcutCommand(page, APP_COMMAND_IDS.editToggleRawEditor)
    await expect(page.getByTestId('raw-editor-codemirror')).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('.bn-editor')).toHaveCount(0)

    await appendRawEditorLine(page, marker)
    await triggerShortcutCommand(page, APP_COMMAND_IDS.fileSave)

    await expect.poll(() => fs.readFileSync(viewPath, 'utf-8')).toContain(marker)
    await expect.poll(() => fs.existsSync(duplicatePath)).toBe(false)

    await openQuickOpenEntry(page, 'Alpha Project')
    await expect(page.locator('.bn-editor')).toBeVisible({ timeout: 5_000 })

    await openQuickOpenEntry(page, VIEW_TITLE)
    await expect(page.getByTestId('raw-editor-codemirror')).toBeVisible({ timeout: 5_000 })
    await expect.poll(async () => readRawEditorContent(page)).toContain(marker)
  })
})
