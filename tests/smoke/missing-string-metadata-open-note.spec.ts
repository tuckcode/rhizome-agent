import { test, expect, type Page } from '@playwright/test'
import {
  createFixtureVaultCopy,
  openFixtureVaultDesktopHarness,
  removeFixtureVaultCopy,
} from '../helpers/fixtureVault'
import { executeCommand, openCommandPalette, openNoteFromNotesList } from './helpers'

let tempVaultDir: string

function isMissingStringMetadataCrash(message: string): boolean {
  return (
    message.includes("Cannot read properties of undefined (reading 'replace')") ||
    message.includes('undefined is not an object') ||
    /undefined.*\.replace|\.replace.*undefined/.test(message)
  )
}

function collectMissingMetadataCrashes(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (error) => {
    if (isMissingStringMetadataCrash(error.message)) errors.push(error.message)
  })
  page.on('console', (message) => {
    if (message.type() === 'error' && isMissingStringMetadataCrash(message.text())) {
      errors.push(message.text())
    }
  })
  return errors
}

function removeAlphaProjectStringMetadata(entries: Array<Record<string, unknown>>) {
  return entries.map((entry) => {
    const entryPath = typeof entry.path === 'string' ? entry.path : ''
    const title = typeof entry.title === 'string' ? entry.title : ''
    if (title !== 'Alpha Project' && !entryPath.endsWith('/alpha-project.md')) return entry
    return {
      ...entry,
      title: undefined,
      filename: undefined,
      aliases: undefined,
      outgoingLinks: undefined,
      relationships: undefined,
      properties: undefined,
      snippet: undefined,
    }
  })
}

function appendMalformedReloadEntry(entries: Array<Record<string, unknown>>) {
  return entries.concat({
    filename: 'phantom-from-reload.md',
    title: 'Phantom From Reload',
    aliases: [],
    outgoingLinks: [],
    relationships: {},
    properties: {},
    snippet: '',
  })
}

function readRouteJsonBody(route: { request: () => { postDataJSON: () => unknown } }): Record<string, unknown> {
  try {
    const body = route.request().postDataJSON()
    return body && typeof body === 'object' && !Array.isArray(body)
      ? body as Record<string, unknown>
      : {}
  } catch {
    return {}
  }
}

async function reloadVaultFromCommandPalette(page: Page): Promise<void> {
  await openCommandPalette(page)
  await executeCommand(page, 'Reload Vault')
  await expect(page.locator('input[placeholder="Type a command..."]')).not.toBeVisible()
}

async function expectAlphaProjectHeading(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Alpha Project', level: 1 })).toBeVisible({ timeout: 5_000 })
}

async function switchFromNoteBBackToAlpha(page: Page): Promise<void> {
  // Re-open Notes each time: narrow viewports collapse the vault panel once a note is open.
  await openNoteFromNotesList(page, 'Note B')
  await openNoteFromNotesList(page, 'alpha-project')
  await expectAlphaProjectHeading(page)
}

test.beforeEach(async ({ page }, testInfo) => {
  testInfo.setTimeout(60_000)
  tempVaultDir = createFixtureVaultCopy()
  await page.route('**/*', async (route) => {
    const requestUrl = new URL(route.request().url())
    if (!requestUrl.pathname.endsWith('/api/vault/list')) {
      await route.continue()
      return
    }
    const response = await route.fetch()
    const entries = await response.json() as Array<Record<string, unknown>>
    const scrubbedEntries = removeAlphaProjectStringMetadata(entries)
    const body = readRouteJsonBody(route)
    const isReload = requestUrl.searchParams.get('reload') === '1' || body.reload === true
    await route.fulfill({
      response,
      json: isReload ? appendMalformedReloadEntry(scrubbedEntries) : scrubbedEntries,
    })
  })
  await openFixtureVaultDesktopHarness(page, tempVaultDir, {
    expectedReadyTitle: 'alpha-project',
  })
  // Stay above the shell compact-vault threshold so the Notes column can reopen.
  await page.setViewportSize({ width: 1400, height: 900 })
})

test.afterEach(() => {
  removeFixtureVaultCopy(tempVaultDir)
})

test('@smoke note open tolerates missing string metadata from the vault scan', async ({ page }) => {
  const errors = collectMissingMetadataCrashes(page)

  await openNoteFromNotesList(page, 'alpha-project')
  await expectAlphaProjectHeading(page)
  await switchFromNoteBBackToAlpha(page)

  expect(errors).toHaveLength(0)
})

test('@smoke note open after vault reload tolerates missing suggestion metadata', async ({ page }) => {
  const errors = collectMissingMetadataCrashes(page)

  await reloadVaultFromCommandPalette(page)

  const noteList = page.getByTestId('note-list-container')
  await expect(noteList.getByText('Phantom From Reload', { exact: true })).toHaveCount(0)
  await switchFromNoteBBackToAlpha(page)

  expect(errors).toHaveLength(0)
})
