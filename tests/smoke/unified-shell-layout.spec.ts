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
    await expect(page.getByTestId('command-rail-inbox')).toContainText('Inbox')
    await expect(page.getByTestId('vault-panel')).toHaveCount(0)

    await openFixtureVault(page, tempVaultDir)

    const vaultPanel = page.getByTestId('vault-panel')
    const browse = page.getByTestId('vault-panel-browse-toggle')
    const collapse = page.getByTestId('vault-panel-collapse')

    await expect(vaultPanel).toHaveCount(1)
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

  test('temporarily collapses side panels while preserving Chat and the editor @smoke', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 })
    await openFixtureVault(page, tempVaultDir)
    await openAlphaProject(page)

    const shell = page.locator('.app')
    await expect(shell).toHaveAttribute('data-compact-sessions', 'true')
    await expect(shell).toHaveAttribute('data-compact-vault', 'false')
    await expect(page.getByTestId('chat-home')).toBeVisible()
    await expect(page.locator('.app__note-editor:not(.app__note-editor--idle)')).toBeVisible()
    await expect(page.getByTestId('vault-panel')).toBeVisible()

    await page.setViewportSize({ width: 1100, height: 800 })
    await expect(shell).toHaveAttribute('data-compact-vault', 'true')
    await expect(page.getByTestId('vault-panel')).toHaveCount(0)
    await expectMinimumTarget(page.getByTestId('vault-panel-restore'))
    await expect(page.getByTestId('chat-home')).toBeVisible()
    await expect(page.locator('.app__note-editor:not(.app__note-editor--idle)')).toBeVisible()
    expect(await shell.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)

    await page.getByTestId('vault-panel-restore').click()
    await expect(page.locator('.app__vault-panel--overlay')).toBeVisible()
    expect(await shell.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)

    await page.setViewportSize({ width: 1500, height: 900 })
    await expect(shell).toHaveAttribute('data-compact-sessions', 'false')
    await expect(shell).toHaveAttribute('data-compact-vault', 'false')
    await expect(page.getByTestId('vault-panel')).toBeVisible()
    await expect(page.getByTestId('prime-session-list')).toBeVisible()

    await page.getByTestId('vault-panel-collapse').click()
    await expect(page.getByTestId('vault-panel')).toHaveCount(0)
    await waitForKeyboardShortcutsReady(page)
    await sendShortcut(page, '2', ['Control'])
    await expect(page.getByTestId('vault-panel')).toBeVisible()
    await expect(page.getByTestId('vault-panel-navigation')).toHaveCount(0)
    await expect(page.getByTestId('note-list-container')).toBeVisible()

    await page.getByRole('button', { name: 'Close sessions' }).click()
    await expect(page.getByTestId('prime-session-list')).toHaveCount(0)
    await page.getByRole('button', { name: 'Open sessions' }).click()
    await expect(page.getByTestId('prime-session-list')).toBeVisible()

    await page.locator('.breadcrumb-bar').getByRole('button', { name: 'Open the properties panel' }).click()
    await expect(shell).toHaveAttribute('data-compact-sessions', 'true')
    await expect(shell).toHaveAttribute('data-compact-vault', 'false')

    await page.setViewportSize({ width: 1300, height: 800 })
    await expect(shell).toHaveAttribute('data-compact-vault', 'true')
    await expect(page.getByTestId('vault-panel')).toHaveCount(0)
  })
})
