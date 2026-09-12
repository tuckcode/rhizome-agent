import { expect, test, type Locator, type Page } from '@playwright/test'
import {
  createFixtureVaultCopy,
  openFixtureVault,
  removeFixtureVaultCopy,
} from '../helpers/fixtureVault'
import { sendShortcut, waitForKeyboardShortcutsReady } from './helpers'

let tempVaultDir: string

async function expectMinimumTarget(locator: Locator, size = 32): Promise<void> {
  await expect(locator).toBeVisible()
  const box = await locator.boundingBox()
  expect(box?.width).toBeGreaterThanOrEqual(size)
  expect(box?.height).toBeGreaterThanOrEqual(size)
}

async function openAlphaProject(page: Page): Promise<void> {
  const noteList = page.getByTestId('note-list-container')
  await noteList.getByText('Alpha Project', { exact: true }).click()
  await expect(page.locator('.app__note-editor:not(.app__note-editor--idle)')).toBeVisible()
}

test.describe('Unified shell geometry', () => {
  test.beforeEach(() => {
    tempVaultDir = createFixtureVaultCopy()
  })

  test.afterEach(() => {
    removeFixtureVaultCopy(tempVaultDir)
  })

  test('opens one Notes panel from the left Inbox rail item @smoke', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 })
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await page.getByTestId('command-rail').hover()
    await expect(page.getByTestId('command-rail-inbox')).toContainText('Inbox')
    // C72: fresh launch defaults to Notes open (editor-list), Browse collapsed
    await expect(page.getByTestId('vault-panel')).toBeVisible()
    await expect(page.getByTestId('vault-panel-navigation')).toHaveCount(0)

    await openFixtureVault(page, tempVaultDir)

    const vaultPanel = page.getByTestId('vault-panel')
    const browse = page.getByTestId('vault-panel-browse-toggle')
    const collapse = page.getByTestId('vault-panel-collapse')

    await expect(vaultPanel).toBeVisible()
    await expect(page.getByTestId('vault-panel-navigation')).toHaveCount(0)
    await expect(page.getByTestId('note-list-container')).toBeVisible()
    await expectMinimumTarget(browse)
    await expectMinimumTarget(collapse)

    await browse.click()
    const navigation = page.getByTestId('vault-panel-navigation')
    await expect(navigation).toBeVisible()
    await expect(navigation.getByText('Inbox', { exact: true }).first()).toBeVisible()
    await expect(navigation.getByText('All Notes', { exact: true }).first()).toBeVisible()
    await expect(navigation.getByText('Archive', { exact: true }).first()).toBeVisible()
    await expect(navigation.getByText('Projects', { exact: true }).first()).toBeVisible()
    await expect(page.getByTestId('note-list-container')).toBeVisible()

    const collapseBox = await collapse.boundingBox()
    if (!collapseBox) throw new Error('Vault collapse button has no bounding box')
    await collapse.click({ position: { x: collapseBox.width - 1, y: collapseBox.height / 2 } })
    await expect(vaultPanel).toHaveCount(0)

    await page.getByTestId('command-rail-inbox').click()
    await expect(page.getByTestId('vault-panel-navigation')).toBeVisible()
    await expect(page.getByTestId('note-list-container')).toBeVisible()
  })

  test('opens a note above Chat and keeps the Notes list @smoke', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 })
    await openFixtureVault(page, tempVaultDir)
    await openAlphaProject(page)

    const shell = page.locator('.app')
    await expect(shell).toHaveAttribute('data-compact-sessions', 'false')
    await expect(shell).toHaveAttribute('data-compact-vault', 'false')
    await expect(page.getByTestId('chat-home')).toBeVisible()
    const noteEditor = page.locator('.app__note-editor:not(.app__note-editor--idle)')
    await expect(noteEditor).toBeVisible()
    await expect(page.getByTestId('vault-panel')).toBeVisible()
    await expect(page.getByTestId('chat-note-editor-resize')).toHaveAttribute('aria-orientation', 'horizontal')
    await expect(page.getByRole('radio', { name: 'Note on top of Chat' })).toBeVisible()
    await expect(page.getByRole('radio', { name: 'Note beside Chat' })).toBeVisible()

    const noteBox = await noteEditor.boundingBox()
    const chatBox = await page.getByTestId('chat-home').boundingBox()
    expect(noteBox).toBeTruthy()
    expect(chatBox).toBeTruthy()
    expect(noteBox!.y + noteBox!.height).toBeLessThanOrEqual(chatBox!.y + 2)

    await page.setViewportSize({ width: 1100, height: 800 })
    await expect(shell).toHaveAttribute('data-compact-vault', 'false')
    await expect(page.getByTestId('vault-panel')).toBeVisible()
    await expect(page.getByTestId('chat-home')).toBeVisible()
    await expect(noteEditor).toBeVisible()
    expect(await shell.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)

    await page.getByTestId('vault-panel-collapse').click()
    await expect(page.getByTestId('vault-panel')).toHaveCount(0)
    await expectMinimumTarget(page.getByTestId('vault-panel-restore'))
    await page.getByTestId('vault-panel-restore').click()
    await expect(page.getByTestId('vault-panel')).toBeVisible()

    await page.setViewportSize({ width: 1500, height: 900 })
    await expect(page.getByTestId('vault-panel')).toBeVisible()
    const rail = page.getByTestId('command-rail')
    await rail.hover()
    await expect(page.getByTestId('prime-session-list')).toBeVisible()

    await page.getByTestId('vault-panel-collapse').click()
    await expect(page.getByTestId('vault-panel')).toHaveCount(0)
    await waitForKeyboardShortcutsReady(page)
    await sendShortcut(page, '2', ['Control'])
    await expect(page.getByTestId('vault-panel')).toBeVisible()
    await expect(page.getByTestId('vault-panel-navigation')).toHaveCount(0)
    await expect(page.getByTestId('note-list-container')).toBeVisible()

    await page.locator('.app__editor').hover()
    await expect(page.getByTestId('prime-session-list')).toHaveCount(0)
    await rail.hover()
    await expect(page.getByTestId('prime-session-list')).toBeVisible()
  })

  test('puts the note beside Chat and collapses Notes @smoke', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 })
    await openFixtureVault(page, tempVaultDir)
    await openAlphaProject(page)

    await page.getByRole('radio', { name: 'Note beside Chat' }).click()

    const shell = page.locator('.app')
    await expect(shell).toHaveAttribute('data-compact-sessions', 'true')
    await expect(shell).toHaveAttribute('data-compact-vault', 'true')
    await expect(page.getByTestId('chat-note-editor-resize')).toHaveAttribute('aria-orientation', 'vertical')
    await expect(page.getByTestId('vault-panel')).toHaveCount(0)
    await expectMinimumTarget(page.getByTestId('vault-panel-restore'))

    const noteEditor = page.locator('.app__note-editor:not(.app__note-editor--idle)')
    const noteBox = await noteEditor.boundingBox()
    const chatBox = await page.getByTestId('chat-home').boundingBox()
    expect(noteBox).toBeTruthy()
    expect(chatBox).toBeTruthy()
    expect(noteBox!.x).toBeGreaterThanOrEqual(chatBox!.x + chatBox!.width - 2)

    await page.getByRole('radio', { name: 'Note on top of Chat' }).click()
    await expect(shell).toHaveAttribute('data-compact-vault', 'false')
    await expect(page.getByTestId('vault-panel')).toBeVisible()
    await expect(page.getByTestId('chat-note-editor-resize')).toHaveAttribute('aria-orientation', 'horizontal')
  })
})
