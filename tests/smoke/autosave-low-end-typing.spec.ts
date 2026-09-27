import fs from 'fs'
import path from 'path'
import { test, expect, type Page } from '@playwright/test'
import {
  createFixtureVaultCopy,
  openFixtureVault,
  removeFixtureVaultCopy,
} from '../helpers/fixtureVault'
import { executeCommand, openCommandPalette, SMOKE_UI_READY_TIMEOUT } from './helpers'

interface AutosaveProbeWindow {
  __autosaveProbe?: Array<{ path: string; content: string }>
}

let tempVaultDir: string

async function openNote(page: Page, title: string) {
  await page.getByTestId('note-list-container').getByText(title, { exact: true }).click()
}

async function openRawMode(page: Page) {
  await openCommandPalette(page)
  await executeCommand(page, 'Toggle Raw')
  await expect(page.locator('.cm-content')).toBeVisible({ timeout: SMOKE_UI_READY_TIMEOUT })
}

async function installAutosaveProbe(page: Page) {
  await page.evaluate(() => {
    const probeWindow = window as typeof window & AutosaveProbeWindow
    const nativeFetch = window.fetch.bind(window)
    const calls: Array<{ path: string; content: string }> = []
    probeWindow.__autosaveProbe = calls

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = typeof input === 'string'
        ? input
        : input instanceof Request
          ? input.url
          : input.toString()
      if (requestUrl.endsWith('/api/vault/save')) {
        const bodyText = init?.body === undefined && input instanceof Request
          ? await input.clone().text()
          : String(init?.body ?? '')
        const body = JSON.parse(bodyText) as { path?: unknown; content?: unknown }
        calls.push({
          path: String(body.path ?? ''),
          content: String(body.content ?? ''),
        })
      }
      return nativeFetch(input, init)
    }
  })
}

async function readAutosaveProbe(page: Page) {
  return page.evaluate(() => {
    const probeWindow = window as typeof window & AutosaveProbeWindow
    return probeWindow.__autosaveProbe ?? []
  })
}

test.beforeEach(async ({ page }, testInfo) => {
  testInfo.setTimeout(60_000)
  tempVaultDir = createFixtureVaultCopy()
  await openFixtureVault(page, tempVaultDir)
  await installAutosaveProbe(page)
})

test.afterEach(() => {
  removeFixtureVaultCopy(tempVaultDir)
})

test('@smoke autosave waits for idle typing and persists the latest draft only', async ({ page }) => {
  const notePath = path.join(tempVaultDir, 'note', 'note-b.md')
  const firstDraft = `# Note B\n\nLow-end autosave first draft ${Date.now()}`
  const latestDraft = `${firstDraft}\n\nLatest draft after continued typing`

  await openNote(page, 'Note B')
  await openRawMode(page)
  await page.evaluate(async ({ first, latest }) => {
    const setContent = (nextContent: string) => {
      const el = document.querySelector('.cm-content')
      if (!el) throw new Error('CodeMirror content element is missing')
      const view = (el as Element & { cmTile?: { view?: {
        state: { doc: { length: number } }
        dispatch: (change: { changes: { from: number; to: number; insert: string } }) => void
      } } }).cmTile?.view
      if (!view) throw new Error('CodeMirror view is missing')
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: nextContent },
      })
    }
    const probe = () => (window as typeof window & AutosaveProbeWindow).__autosaveProbe ?? []

    setContent(first)
    await new Promise((resolve) => setTimeout(resolve, 400))
    if (probe().length > 0) throw new Error('autosave wrote the first draft before typing continued')
    setContent(latest)
    await new Promise((resolve) => setTimeout(resolve, 400))
    if (probe().length > 0) throw new Error('autosave wrote a draft before typing went idle')
  }, { first: firstDraft, latest: latestDraft })

  expect(await readAutosaveProbe(page)).toEqual([])

  await expect.poll(() => readAutosaveProbe(page), { timeout: SMOKE_UI_READY_TIMEOUT }).toEqual([
    expect.objectContaining({ path: notePath, content: latestDraft }),
  ])
  expect(fs.readFileSync(notePath, 'utf8')).toBe(latestDraft)
})
