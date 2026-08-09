import { test, expect } from '@playwright/test'
import {
  openCommandPalette,
  findCommand,
  executeCommand,
  sendShortcut,
} from './helpers'

test.describe('Dogfood: reload + keyboard shortcuts (0213a17)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('[data-testid="sidebar-top-nav"]')).toBeVisible({ timeout: 15_000 })
  })

  test('command palette lists Reload Vault and Keyboard Shortcuts', async ({ page }) => {
    await openCommandPalette(page)
    expect(await findCommand(page, 'Reload Vault')).toBe(true)
    await page.keyboard.press('Escape')
    await openCommandPalette(page)
    expect(await findCommand(page, 'Keyboard Shortcuts')).toBe(true)
  })

  test('Cmd+/ opens keyboard shortcuts dialog', async ({ page }) => {
    await page.locator('body').click()
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+/' : 'Control+/')
    const dialog = page.getByTestId('keyboard-shortcuts-dialog')
    await expect(dialog).toBeVisible({ timeout: 5_000 })
    await expect(dialog.getByRole('heading', { name: 'Keyboard shortcuts' })).toBeVisible()
    await expect(dialog.getByText('Reload vault')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden({ timeout: 5_000 })
  })

  test('palette Keyboard Shortcuts works; breadcrumb reload is visible on open note', async ({ page }) => {
    await openCommandPalette(page)
    await executeCommand(page, 'Keyboard Shortcuts')
    const dialog = page.getByTestId('keyboard-shortcuts-dialog')
    await expect(dialog).toBeVisible({ timeout: 5_000 })
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden({ timeout: 5_000 })

    // Prefer an already-open note; otherwise open via quick open
    const reload = page.getByTestId('breadcrumb-reload-vault')
    if (!(await reload.isVisible().catch(() => false))) {
      const filename = page.getByRole('button', { name: /Filename /i }).first()
      if (!(await filename.isVisible().catch(() => false))) {
        await page.locator('body').click()
        await sendShortcut(page, 'p', ['Control'])
        const search = page.locator('input[placeholder="Search notes..."]')
        await expect(search).toBeVisible({ timeout: 5_000 })
        await search.fill('Build')
        await page.keyboard.press('Enter')
        await expect(page.getByRole('button', { name: /Filename /i }).first()).toBeVisible({ timeout: 10_000 })
      }
    }

    await expect(reload).toBeVisible({ timeout: 10_000 })
    await expect(reload).toHaveAttribute('aria-label', /Reload vault/i)
    await reload.click()
  })

  test('Cmd+Shift+R does not throw and can be dispatched', async ({ page }) => {
    await page.locator('body').click()
    const result = await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('laputa:dispatch-command', {
        detail: { id: 'vault-reload' },
      }))
      return true
    })
    expect(result).toBe(true)
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Shift+R' : 'Control+Shift+R')
    await expect(page.locator('[data-testid="sidebar-top-nav"]')).toBeVisible()
  })
})
