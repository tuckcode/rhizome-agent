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
  const restore = page.getByTestId('vault-panel-restore')
  if (await restore.isVisible().catch(() => false)) {
    await restore.click()
  }
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

  test('opens Notes from the Show Notes strip @smoke', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 })
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await page.getByTestId('command-rail').hover()
    await expect(page.getByTestId('command-rail')).toBeVisible()
    await expect(page.getByTestId('command-rail-chat')).toHaveCount(0)
    await expect(page.getByTestId('command-rail-research')).toHaveCount(0)
    await expect(page.getByTestId('command-rail-inbox')).toHaveCount(0)
    // Fresh launch is Chat with the existing Show Notes restore strip.
    await expect(page.getByTestId('vault-panel')).toHaveCount(0)
    await expect(page.getByTestId('vault-panel-restore')).toBeVisible()
    await expect(page.getByTestId('vault-panel-navigation')).toHaveCount(0)

    await openFixtureVault(page, tempVaultDir)
    // openFixtureVault already opens Notes so the list is ready.
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

    await page.getByTestId('vault-panel-restore').click()
    await expect(page.getByTestId('vault-panel')).toBeVisible()
    await expect(page.getByTestId('vault-panel-navigation')).toHaveCount(0)
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
    await expect(shell).toHaveAttribute('data-pane-preset', 'read')
    await expect(shell).toHaveAttribute('data-compact-vault', 'false')
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
  test('remembers preset widths, clamps drags, folds narrow columns, and resets', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 })
    await openFixtureVault(page, tempVaultDir)
    await openAlphaProject(page)
    await waitForKeyboardShortcutsReady(page)
    const shell = page.locator('.app')
    const chat = page.getByTestId('chat-home')
    const notes = page.getByTestId('vault-panel-note-list')
    const drag = async (testId: string, delta: number) => {
      const box = await page.getByTestId(testId).boundingBox()
      if (!box) throw new Error(`Missing divider: ${testId}`)
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.mouse.down()
      await page.mouse.move(box.x + box.width / 2 + delta, box.y + box.height / 2, { steps: 10 })
      await page.mouse.up()
    }
    await drag('vault-panel-resize', -100)
    await expect.poll(async () => (await notes.boundingBox())?.width).toBe(340)
    await sendShortcut(page, '3', ['Control'])
    await expect(shell).toHaveAttribute('data-pane-preset', 'workbench')
    await expect.poll(async () => (await notes.boundingBox())?.width).toBe(240)
    await drag('browse-panel-resize', -40)
    await expect.poll(async () => (await page.getByTestId('vault-panel-navigation').boundingBox())?.width).toBe(280)
    await sendShortcut(page, '2', ['Control'])
    await expect.poll(async () => (await notes.boundingBox())?.width).toBe(340)
    await page.setViewportSize({ width: 720, height: 800 })
    await drag('vault-panel-resize', -400)
    expect((await chat.boundingBox())!.width).toBeGreaterThanOrEqual(420)
    expect(await shell.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)
    await page.setViewportSize({ width: 639, height: 800 })
    await expect(page.getByTestId('vault-panel')).toHaveCount(0)
    expect((await chat.boundingBox())!.width).toBeGreaterThanOrEqual(420)
    await sendShortcut(page, '4', ['Control'])
    await expect(shell).toHaveAttribute('data-pane-preset', 'read')
    await expect(page.getByTestId('chat-center')).toHaveAttribute('data-split', 'stacked')
    await page.screenshot({ path: '/tmp/pane-presets-narrow.png' })
    await page.setViewportSize({ width: 1400, height: 900 })
    await expect(page.getByTestId('chat-center')).toHaveAttribute('data-split', 'side-by-side')
    await drag('chat-note-editor-resize', -100)
    expect((await chat.boundingBox())!.width).toBeGreaterThanOrEqual(420)
    await sendShortcut(page, '3', ['Control'])
    await expect.poll(async () => (await page.getByTestId('vault-panel-navigation').boundingBox())?.width).toBe(280)
    await page.screenshot({ path: '/tmp/pane-presets-workbench.png' })
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('laputa:dispatch-command', { detail: 'view-reset-layout' })))
    await expect(shell).toHaveAttribute('data-pane-preset', 'chat')
    await expect(page.getByTestId('vault-panel-restore')).toBeVisible()
    await sendShortcut(page, '3', ['Control'])
    await expect.poll(async () => (await notes.boundingBox())?.width).toBe(240)
    await expect.poll(async () => (await page.getByTestId('vault-panel-navigation').boundingBox())?.width).toBe(240)
  })

})
