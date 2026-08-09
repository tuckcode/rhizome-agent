import { test, expect, type Locator, type Page } from '@playwright/test'
import { createFixtureVaultCopy, openFixtureVault, removeFixtureVaultCopy } from '../helpers/fixtureVault'

let tempVaultDir: string

test.beforeEach(async ({ page }, testInfo) => {
  testInfo.setTimeout(60_000)
  tempVaultDir = createFixtureVaultCopy()
  await openFixtureVault(page, tempVaultDir)
})

test.afterEach(async () => {
  removeFixtureVaultCopy(tempVaultDir)
})

async function applyZoom(page: Page, percent: number) {
  await page.evaluate((pct) => {
    document.documentElement.style.setProperty('zoom', `${pct}%`)
    window.dispatchEvent(new Event('laputa-zoom-change'))
  }, percent)
  await page.waitForTimeout(250)
}

async function movePointerFromBlockToHandle(
  page: Page,
  block: Locator,
  handle: Locator,
) {
  const blockBox = await block.boundingBox()
  const handleBox = await handle.boundingBox()

  expect(blockBox).not.toBeNull()
  expect(handleBox).not.toBeNull()

  await page.mouse.move(
    blockBox!.x + blockBox!.width / 2,
    blockBox!.y + blockBox!.height / 2,
  )
  await page.waitForTimeout(100)
  await page.mouse.move(
    handleBox!.x + handleBox!.width / 2,
    handleBox!.y + handleBox!.height / 2,
    { steps: 12 },
  )
}

async function expectZoomedHandleClickToWork(
  page: Page,
  block: Locator,
) {
  await block.hover()

  const dragHandle = page.locator('.bn-side-menu [draggable="true"]').first()
  await expect(dragHandle).toBeVisible({ timeout: 5_000 })

  await movePointerFromBlockToHandle(page, block, dragHandle)
  await expect(dragHandle).toBeVisible({ timeout: 2_000 })

  const handleBox = await dragHandle.boundingBox()
  expect(handleBox).not.toBeNull()

  await page.mouse.click(
    handleBox!.x + handleBox!.width / 2,
    handleBox!.y + handleBox!.height / 2,
  )

  const menu = page.locator('.mantine-Menu-dropdown').filter({ has: page.locator('.mantine-Menu-item') }).first()
  await expect(menu).toBeVisible({ timeout: 5_000 })
  await expect(menu.getByRole('menuitem', { name: 'Delete' })).toBeVisible()
  await expect(menu.getByRole('menuitem', { name: 'Colors' })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(menu).toBeHidden({ timeout: 5_000 })
}

test('block handles stay clickable while zoomed in', async ({ page }) => {
  await page.getByText('Alpha Project', { exact: true }).first().click()
  const editor = page.locator('.bn-editor')
  await expect(editor).toBeVisible({ timeout: 5_000 })

  await applyZoom(page, 150)

  await expectZoomedHandleClickToWork(
    page,
    editor.getByRole('heading', { name: 'Alpha Project', level: 1 }),
  )

  await expectZoomedHandleClickToWork(
    page,
    editor.getByText('This is a test project that references other notes.', { exact: true }),
  )

  await expectZoomedHandleClickToWork(
    page,
    editor.getByRole('heading', { name: 'Notes', level: 2 }),
  )
})
